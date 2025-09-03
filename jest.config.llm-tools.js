/**
 * Jest configuration for LLM Tools testing
 * Targets 95% code coverage for tool functions
 * 100% coverage for security validation paths
 */

module.exports = {
  displayName: 'LLM Tools',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/llm-tools/**/*.test.ts',
    '<rootDir>/tests/llm-tools/**/*.spec.ts',
    '<rootDir>/tests/llm-tools/**/test_*.ts'
  ],
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@llm-tools/(.*)$': '<rootDir>/src/services/llm-tools/$1'
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/llm-tools/setup.ts'
  ],
  collectCoverageFrom: [
    'src/services/llm-tools/**/*.{ts,tsx}',
    '!src/services/llm-tools/**/*.d.ts',
    '!src/services/llm-tools/**/index.ts',
    '!src/services/llm-tools/**/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 95,
      lines: 90,
      statements: 90
    },
    'src/services/llm-tools/security/**': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    'src/services/llm-tools/validation/**': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage/llm-tools',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      suiteNameTemplate: '{filepath}',
      addFileAttribute: 'true'
    }]
  ],
  testTimeout: 10000,
  maxWorkers: '50%',
  bail: false,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  errorOnDeprecated: true,
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};