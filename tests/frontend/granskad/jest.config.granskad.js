/**
 * Jest configuration for Granskad Workflow tests
 * Specialized configuration for Swedish waste management review system
 */

module.exports = {
  displayName: 'Granskad Workflow Tests',
  testEnvironment: 'jsdom',
  rootDir: '../../../',
  roots: ['<rootDir>/tests/frontend/granskad'],
  testMatch: [
    '**/tests/frontend/granskad/**/test_*.tsx',
    '**/tests/frontend/granskad/**/test_*.ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/frontend/granskad/setup.ts'
  ],
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/stores/(.*)$': '<rootDir>/src/stores/$1',
    '^@/contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/test-utils/(.*)$': '<rootDir>/tests/utils/$1',
    
    // CSS modules
    '\\.css$': 'identity-obj-proxy',
    '\\.module\\.css$': 'identity-obj-proxy',
    
    // Static assets
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/frontend/granskad/__mocks__/fileMock.js'
  },
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'components/workflow/**/*.{ts,tsx}',
    'components/workflow/hooks/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**'
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './components/workflow/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Test timeout for async operations
  testTimeout: 10000,
  
  // TypeScript configuration is now handled in transform
  
  // Verbose output for TDD
  verbose: true,
  
  // Watch plugins for better DX
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Custom reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results/granskad',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};