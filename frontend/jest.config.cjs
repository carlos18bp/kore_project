const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/**/__tests__/**/*.test.(ts|tsx)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/stores/**/*.{ts,tsx}',
    'lib/services/**/*.{ts,tsx}',
    'app/composables/**/*.{ts,tsx}',
    'app/components/**/*.{ts,tsx}',
    'app/(public)/**/*.{ts,tsx}',
    'app/(app)/**/*.{ts,tsx}',
    '!app/**/layout.tsx',
    '!**/__tests__/**',
    '!**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
};

module.exports = createJestConfig(customJestConfig);
