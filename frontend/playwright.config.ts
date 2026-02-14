import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: [
    ['list'],
    ['monocart-reporter', {
      name: 'KÓRE E2E Coverage Report',
      outputFile: './coverage-e2e/report.html',
      coverage: {
        reports: [
          ['text'],
          ['text-summary'],
          ['v8'],
          ['lcovonly', { file: 'lcov.info' }],
        ],
        outputDir: './coverage-e2e/coverage',
        watermarks: {
          statements: [50, 80],
          branches: [50, 80],
          functions: [50, 80],
          lines: [50, 80],
          bytes: [50, 80],
        },
        entryFilter: (entry: { url: string }) => entry.url.includes('localhost:3000') && !entry.url.includes('node_modules'),
        sourceFilter: (sourcePath: string) => {
          if (sourcePath.includes('node_modules')) return false;
          if (sourcePath.includes('_next/static/chunks/webpack')) return false;
          if (sourcePath.includes('[turbopack]')) return false;
          if (sourcePath.includes('localhost-3000')) return false;
          return sourcePath.search(/app\/|lib\//) !== -1;
        },
      },
    }],
  ],
  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
