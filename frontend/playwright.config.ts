import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface FileCoverage {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

interface CoverageSummary {
  total: FileCoverage;
  [filePath: string]: FileCoverage;
}

function getStatusLabel(pct: number): { label: string; color: string } {
  if (pct < 50) return { label: 'Needs work', color: colors.red };
  if (pct < 80) return { label: 'Low', color: colors.yellow };
  return { label: 'Good', color: colors.green };
}

function createProgressBar(pct: number, width: number = 20): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const { color } = getStatusLabel(pct);
  return `${color}${'█'.repeat(filled)}${colors.dim}${'░'.repeat(empty)}${colors.reset}`;
}

interface CoverageData {
  summary?: { statements?: number; branches?: number; functions?: number; lines?: number };
  files?: Array<{ sourcePath: string; summary: { lines: { pct: number } } }>;
}

function printCoverageColorReportFromData(coverage: CoverageData): void {
  const summary = coverage.summary;
  if (!summary) return;

  console.log('');
  console.log(`${colors.cyan}${colors.bold}📊 E2E Coverage Color Report${colors.reset}`);
  console.log('');

  const metrics = [
    { name: 'Statements', pct: summary.statements ?? 0 },
    { name: 'Branches', pct: summary.branches ?? 0 },
    { name: 'Functions', pct: summary.functions ?? 0 },
    { name: 'Lines', pct: summary.lines ?? 0 },
  ];

  for (const metric of metrics) {
    const { label, color } = getStatusLabel(metric.pct);
    const bar = createProgressBar(metric.pct);
    const pctStr = metric.pct.toFixed(2).padStart(6);
    console.log(`  ${metric.name.padEnd(12)} ${color}${pctStr}%${colors.reset}  ${bar}  ${color}${label}${colors.reset}`);
  }

  // Get 16 files with lowest coverage (by lines)
  if (coverage.files && coverage.files.length > 0) {
    const files = coverage.files
      .filter(f => f.sourcePath.includes('app/') || f.sourcePath.includes('lib/'))
      .map(f => ({ path: f.sourcePath, linesPct: f.summary.lines.pct }))
      .sort((a, b) => a.linesPct - b.linesPct)
      .slice(0, 16);

    if (files.length > 0) {
      console.log('');
      console.log(`${colors.yellow}⚠ 16 files with lowest coverage (Lines):${colors.reset}`);
      for (const file of files) {
        const { color } = getStatusLabel(file.linesPct);
        const fileName = path.basename(file.path);
        console.log(`  ${color}${file.linesPct.toFixed(1).padStart(5)}%${colors.reset}  ${fileName}`);
      }
    }
  }

  console.log('');
}

function printCoverageColorReport(): void {
  const summaryPath = path.join(process.cwd(), 'coverage-e2e/coverage/coverage-summary.json');
  
  if (!fs.existsSync(summaryPath)) {
    console.log(`${colors.yellow}⚠ Coverage summary not found at ${summaryPath}${colors.reset}`);
    return;
  }

  const summary: CoverageSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  const total = summary.total;

  console.log('');
  console.log(`${colors.cyan}${colors.bold}📊 E2E Coverage Color Report${colors.reset}`);
  console.log('');

  const metrics = [
    { name: 'Statements', pct: total.statements.pct },
    { name: 'Branches', pct: total.branches.pct },
    { name: 'Functions', pct: total.functions.pct },
    { name: 'Lines', pct: total.lines.pct },
  ];

  for (const metric of metrics) {
    const { label, color } = getStatusLabel(metric.pct);
    const bar = createProgressBar(metric.pct);
    const pctStr = metric.pct.toFixed(2).padStart(6);
    console.log(`  ${metric.name.padEnd(12)} ${color}${pctStr}%${colors.reset}  ${bar}  ${color}${label}${colors.reset}`);
  }

  // Get 10 files with lowest coverage (by lines)
  const files: Array<{ path: string; linesPct: number }> = [];
  for (const [filePath, coverage] of Object.entries(summary)) {
    if (filePath === 'total') continue;
    // Filter to only include source files (app/ or lib/)
    if (filePath.includes('app/') || filePath.includes('lib/')) {
      files.push({ path: filePath, linesPct: coverage.lines.pct });
    }
  }

  files.sort((a, b) => a.linesPct - b.linesPct);
  const lowest10 = files.slice(0, 10);

  if (lowest10.length > 0) {
    console.log('');
    console.log(`${colors.yellow}⚠ 10 files with lowest coverage (Lines):${colors.reset}`);
    for (const file of lowest10) {
      const { color } = getStatusLabel(file.linesPct);
      const fileName = path.basename(file.path);
      console.log(`  ${color}${file.linesPct.toFixed(1).padStart(5)}%${colors.reset}  ${fileName}`);
    }
  }

  console.log('');
}

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
          ['json-summary', { file: 'coverage-summary.json' }],
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onEnd: (coverageResults: any) => {
          if (!coverageResults || !coverageResults.summary) return;

          const summary = coverageResults.summary;
          console.log('');
          console.log(`${colors.cyan}${colors.bold}📊 E2E Coverage Color Report${colors.reset}`);
          console.log('');

          const metrics = [
            { name: 'Statements', pct: typeof summary.statements === 'object' ? summary.statements.pct : summary.statements ?? 0 },
            { name: 'Branches', pct: typeof summary.branches === 'object' ? summary.branches.pct : summary.branches ?? 0 },
            { name: 'Functions', pct: typeof summary.functions === 'object' ? summary.functions.pct : summary.functions ?? 0 },
            { name: 'Lines', pct: typeof summary.lines === 'object' ? summary.lines.pct : summary.lines ?? 0 },
          ];

          for (const metric of metrics) {
            const { label, color } = getStatusLabel(metric.pct);
            const bar = createProgressBar(metric.pct);
            const pctStr = metric.pct.toFixed(2).padStart(6);
            console.log(`  ${metric.name.padEnd(12)} ${color}${pctStr}%${colors.reset}  ${bar}  ${color}${label}${colors.reset}`);
          }

          // Get 10 files with lowest coverage from coverageResults.files
          const files = coverageResults.files || [];
          if (files.length > 0) {
            const sortedFiles = files
              .filter((f: { sourcePath?: string }) => {
                const sp = f.sourcePath || '';
                return sp.includes('app/') || sp.includes('lib/');
              })
              .map((f: { sourcePath?: string; summary?: { lines?: { pct?: number } } }) => ({
                path: f.sourcePath || '',
                linesPct: f.summary?.lines?.pct ?? 0,
              }))
              .sort((a: { linesPct: number }, b: { linesPct: number }) => a.linesPct - b.linesPct)
              .slice(0, 16);

            if (sortedFiles.length > 0) {
              console.log('');
              console.log(`${colors.yellow}⚠ 16 files with lowest coverage (Lines):${colors.reset}`);
              for (const file of sortedFiles) {
                const { color } = getStatusLabel(file.linesPct);
                const fileName = path.basename(file.path);
                console.log(`  ${color}${file.linesPct.toFixed(1).padStart(5)}%${colors.reset}  ${fileName}`);
              }
            }
          }
          console.log('');
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
