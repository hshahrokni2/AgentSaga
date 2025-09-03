/**
 * Test setup for Granskad Workflow tests
 * Configures test environment, mocks, and global utilities
 */

import '@testing-library/jest-dom';
import { expect } from '@jest/globals';
import { toHaveNoViolations } from 'jest-axe';
import { TextEncoder, TextDecoder } from 'util';
import crypto from 'crypto';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Polyfill TextEncoder/TextDecoder for Node environment
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock crypto for snapshot hashing
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (buffer: any) => crypto.randomBytes(buffer.length),
    subtle: {
      digest: async (algorithm: string, data: BufferSource) => {
        const hash = crypto.createHash('sha256');
        hash.update(Buffer.from(data as any));
        return hash.digest();
      }
    }
  }
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() { return []; }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage (same implementation as localStorage)
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock
});

// Mock navigator for Swedish locale
Object.defineProperty(navigator, 'language', {
  writable: true,
  value: 'sv-SE'
});

Object.defineProperty(navigator, 'languages', {
  writable: true,
  value: ['sv-SE', 'sv', 'en']
});

// Mock Intl.DateTimeFormat for Swedish formatting
const originalDateTimeFormat = Intl.DateTimeFormat;
global.Intl.DateTimeFormat = function(locale?: string | string[], options?: any) {
  return new originalDateTimeFormat(locale || 'sv-SE', options);
} as any;

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((message) => {
    // Only log actual errors, not React warnings
    if (!message?.includes?.('Warning:') && 
        !message?.includes?.('act()') &&
        !message?.includes?.('Not wrapped in act')) {
      originalError(message);
    }
  });

  console.warn = jest.fn((message) => {
    // Filter out known warnings
    if (!message?.includes?.('componentWillReceiveProps')) {
      originalWarn(message);
    }
  });
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clear all mocks between tests
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  document.body.innerHTML = '';
});

// Custom test utilities
export const waitForAsync = (ms: number = 100) => 
  new Promise(resolve => setTimeout(resolve, ms));

export const mockSwedishDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const generateMockPersonnummer = (valid: boolean = true) => {
  const year = Math.floor(Math.random() * 100);
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  const birth = `${year.toString().padStart(2, '0')}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
  const suffix = valid ? '1234' : 'XXXX';
  return `${birth}-${suffix}`;
};

// Swedish test data helpers
export const swedishTestData = {
  suppliers: [
    { id: 'supplier-1', name: 'Återvinning AB', orgNr: '556677-8899' },
    { id: 'supplier-2', name: 'Miljöhantering Sverige', orgNr: '556688-9900' },
    { id: 'supplier-3', name: 'Kretslopp & Vatten', orgNr: '556699-0011' }
  ],
  
  wasteCategories: [
    { code: '20 01 01', name: 'Papper och kartong' },
    { code: '20 01 08', name: 'Biologiskt nedbrytbart köks- och restaurangavfall' },
    { code: '20 03 01', name: 'Blandat kommunalt avfall' }
  ],
  
  months: [
    'januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december'
  ],
  
  clearanceStatuses: {
    green: { label: 'Grön', color: '#10b981' },
    yellow: { label: 'Gul', color: '#f59e0b' },
    red: { label: 'Röd', color: '#ef4444' }
  }
};

// Export test IDs for consistency
export const testIds = {
  layout: {
    checklistPanel: 'granskad-checklist-panel',
    findingsTable: 'granskad-findings-table',
    commentDrawer: 'granskad-comment-drawer'
  },
  
  buttons: {
    startReview: 'btn-start-review',
    markAsReviewed: 'btn-mark-reviewed',
    addComment: 'btn-add-comment',
    saveSnapshot: 'btn-save-snapshot'
  },
  
  status: {
    badge: 'status-badge',
    clearance: 'clearance-indicator',
    progress: 'progress-bar'
  }
};