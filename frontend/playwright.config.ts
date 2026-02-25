import { defineConfig, devices } from '@playwright/test';

const reporters = [
  ['list'],
  ['./e2e/reporters/flow-coverage-reporter.mjs', {
    definitionsPath: './e2e/flow-definitions.json',
    outputDir: './e2e-results',
    outputFile: 'flow-coverage.json',
    printDetails: true,
  }],
];

if (process.env.E2E_REPORTS === '1') {
  reporters.push(
    ['html', { open: 'never' }],
    ['json', { outputFile: 'e2e-results/results.json' }]
  );
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  workers: 3, // Reduced to 1 for environments with limited resources
  reporter: reporters,
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
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Tablet',
    //   use: { ...devices['iPad Mini'] },
    // },
  ],
});
