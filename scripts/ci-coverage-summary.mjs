#!/usr/bin/env node

/**
 * CI Coverage Summary Generator
 *
 * Reads coverage artifacts from backend (pytest-cov), frontend unit (Jest),
 * and frontend E2E (Playwright flow-coverage-reporter) and writes a
 * GitHub-flavored Markdown report to coverage-report.md.
 *
 * Usage (from repo root):
 *   node scripts/ci-coverage-summary.mjs
 *
 * Expects artifacts at:
 *   coverage-artifacts/backend/coverage.json
 *   coverage-artifacts/frontend-unit/coverage-summary.json
 *   coverage-artifacts/frontend-e2e/flow-coverage.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// ── Paths ──

const PATHS = {
  backend: 'coverage-artifacts/backend/coverage.json',
  unit: 'coverage-artifacts/frontend-unit/coverage-summary.json',
  e2e: 'coverage-artifacts/frontend-e2e/flow-coverage.json',
};
const OUTPUT = 'coverage-report.md';

// ── Helpers ──

function readJSON(filepath) {
  if (!filepath || !existsSync(filepath)) return null;
  try {
    return JSON.parse(readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

function dot(pct) {
  if (pct == null) return '⚪';
  if (pct > 80) return '🟢';
  if (pct >= 50) return '🟡';
  return '🔴';
}

function pctFmt(pct) {
  if (pct == null) return 'N/A';
  return `${pct.toFixed(1)}%`;
}

function bar(pct, width = 16) {
  if (pct == null) return '';
  const filled = Math.round((pct / 100) * width);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
}

// ── Extract data ──

function extractBackend(data) {
  if (!data) return null;
  const t = data.totals;
  const stmtsCov = t.covered_lines ?? 0;
  const stmtsTotal = t.num_statements ?? 0;
  const stmtsPct = t.percent_covered != null
    ? t.percent_covered
    : (stmtsTotal > 0 ? (stmtsCov / stmtsTotal) * 100 : 0);
  const branchCov = t.covered_branches ?? 0;
  const branchTotal = t.num_branches ?? 0;
  const branchPct = t.percent_branches_covered != null
    ? t.percent_branches_covered
    : (branchTotal > 0 ? (branchCov / branchTotal) * 100 : 0);

  // Aggregate function coverage from per-file data
  let funcsCov = 0;
  let funcsTotal = 0;
  if (data.files) {
    for (const info of Object.values(data.files)) {
      for (const [fname, fdata] of Object.entries(info.functions ?? {})) {
        if (fname === '') continue; // skip module-level pseudo-function
        funcsTotal++;
        if ((fdata.summary?.covered_lines ?? 0) > 0) funcsCov++;
      }
    }
  }
  const funcsPct = funcsTotal > 0 ? (funcsCov / funcsTotal) * 100 : 0;

  // Lines = same as statements in coverage.py
  const linesCov = stmtsCov;
  const linesTotal = stmtsTotal;
  const linesPct = stmtsPct;

  return {
    stmtsCov, stmtsTotal, stmtsPct,
    branchCov, branchTotal, branchPct,
    funcsCov, funcsTotal, funcsPct,
    linesCov, linesTotal, linesPct,
  };
}

function extractUnit(data) {
  if (!data) return null;
  const t = data.total;
  return {
    stmts: { covered: t.statements?.covered ?? 0, total: t.statements?.total ?? 0, pct: t.statements?.pct ?? 0 },
    branches: { covered: t.branches?.covered ?? 0, total: t.branches?.total ?? 0, pct: t.branches?.pct ?? 0 },
    funcs: { covered: t.functions?.covered ?? 0, total: t.functions?.total ?? 0, pct: t.functions?.pct ?? 0 },
    lines: { covered: t.lines?.covered ?? 0, total: t.lines?.total ?? 0, pct: t.lines?.pct ?? 0 },
  };
}

function extractE2E(data) {
  if (!data) return null;
  const s = data.summary?.totals ?? data.summary;
  return {
    total: s.total ?? 0,
    covered: s.covered ?? 0,
    partial: s.partial ?? 0,
    failing: s.failing ?? 0,
    missing: s.missing ?? 0,
  };
}

// ── Per-file extraction ──

function extractBackendFiles(data) {
  if (!data?.files) return [];
  return Object.entries(data.files)
    .map(([filepath, info]) => {
      const s = info.summary;
      const stmts = s.num_statements ?? 0;
      const covered = s.covered_lines ?? 0;
      const missing = s.missing_lines ?? 0;
      const pct = s.percent_covered ?? (stmts > 0 ? (covered / stmts) * 100 : 100);
      const brPct = s.percent_branches_covered ?? 0;
      const short = filepath.replace(/.*\/core_app\//, 'core_app/');
      return { path: short, covered, total: stmts, missing, pct, brPct };
    })
    .filter(f => f.total > 0);
}

function extractUnitFiles(data) {
  if (!data) return [];
  return Object.entries(data)
    .filter(([k]) => k !== 'total')
    .map(([filepath, info]) => {
      const stmts = info.statements?.total ?? 0;
      const covered = info.statements?.covered ?? 0;
      const missing = stmts - covered;
      const pct = info.statements?.pct ?? (stmts > 0 ? (covered / stmts) * 100 : 100);
      const brPct = info.branches?.pct ?? 0;
      const fnPct = info.functions?.pct ?? 0;
      const short = filepath.replace(/.*\/frontend\//, '');
      return { path: short, covered, total: stmts, missing, pct, brPct, fnPct };
    })
    .filter(f => f.total > 0);
}

function extractE2EFlows(data) {
  if (!data) return [];
  const flows = data.flows ?? [];
  return (Array.isArray(flows) ? flows : Object.values(flows)).map(f => ({
    id: f.id ?? f.flowId ?? '',
    name: f.name ?? f.definition?.name ?? f.id ?? f.flowId ?? '',
    module: f.module ?? f.definition?.module ?? '',
    priority: f.priority ?? f.definition?.priority ?? 'P4',
    status: f.status ?? 'missing',
    tests: f.tests ?? { total: 0, passed: 0, failed: 0, skipped: 0 },
    knownGaps: f.knownGaps ?? f.definition?.knownGaps ?? [],
  }));
}

// ── Build markdown ──

function build(be, fe, e2e, beFiles, feFiles, e2eFlows) {
  const lines = [];

  lines.push('## 📊 Coverage Report', '');

  // ── Test Results ──
  let e2ePassed = 0, e2eFailed = 0, e2eSkipped = 0, e2eTotal = 0;
  for (const f of e2eFlows) {
    e2ePassed += f.tests.passed ?? 0;
    e2eFailed += f.tests.failed ?? 0;
    e2eSkipped += f.tests.skipped ?? 0;
    e2eTotal += f.tests.total ?? 0;
  }
  const hasAnyFailure = e2eFailed > 0;
  const resultEmoji = hasAnyFailure ? '⚠️' : '✅';
  const totalStr = e2eTotal > 0 ? ` — ${e2ePassed}/${e2eTotal} passed` : '';
  lines.push(`### ${resultEmoji} Test Results${totalStr}`, '');
  lines.push('| Suite | Passed | Failed | Skipped | Total |');
  lines.push('|-------|--------|--------|---------|-------|');
  lines.push('| Backend (pytest) | — | — | — | — |');
  lines.push('| Frontend Unit (Jest) | — | — | — | — |');
  if (e2eTotal > 0) {
    lines.push(`| Frontend E2E (Playwright) | ${e2ePassed} | ${e2eFailed} | ${e2eSkipped} | ${e2eTotal} |`);
  } else {
    lines.push('| Frontend E2E (Playwright) | — | — | — | — |');
  }
  lines.push('');

  // ── Summary table ──
  lines.push('| Suite | Coverage | Bar | Details |');
  lines.push('|-------|----------|-----|---------|');

  if (be) {
    const details = `${be.stmtsCov}/${be.stmtsTotal} stmts, ${pctFmt(be.branchPct)} branches, ${pctFmt(be.funcsPct)} funcs`;
    lines.push(`| Backend (pytest) | ${dot(be.stmtsPct)} ${pctFmt(be.stmtsPct)} | \`${bar(be.stmtsPct)}\` | ${details} |`);
  } else {
    lines.push('| Backend (pytest) | ⚪ N/A | | *data unavailable* |');
  }

  if (fe) {
    const details = `${fe.stmts.covered}/${fe.stmts.total} stmts, ${pctFmt(fe.branches.pct)} branches, ${pctFmt(fe.funcs.pct)} funcs`;
    lines.push(`| Frontend Unit (Jest) | ${dot(fe.stmts.pct)} ${pctFmt(fe.stmts.pct)} | \`${bar(fe.stmts.pct)}\` | ${details} |`);
  } else {
    lines.push('| Frontend Unit (Jest) | ⚪ N/A | | *data unavailable* |');
  }

  if (e2e) {
    const covPct = e2e.total > 0 ? (e2e.covered / e2e.total) * 100 : 0;
    const details = `${e2e.covered}/${e2e.total} flows covered, ${e2e.failing} failing, ${e2e.missing} missing`;
    lines.push(`| Frontend E2E (Playwright) | ${dot(covPct)} ${pctFmt(covPct)} | \`${bar(covPct)}\` | ${details} |`);
  } else {
    lines.push('| Frontend E2E (Playwright) | ⚪ N/A | | *data unavailable* |');
  }

  lines.push('');

  // ── Backend Details ──
  lines.push('<details>');
  lines.push('<summary>▼ 🐍 Backend Details</summary>');
  lines.push('');
  if (be) {
    lines.push('| Metric | Covered | Total | % |');
    lines.push('|--------|---------|-------|---|');
    lines.push(`| Statements | ${be.stmtsCov} | ${be.stmtsTotal} | ${pctFmt(be.stmtsPct)} |`);
    lines.push(`| Branches | ${be.branchCov} | ${be.branchTotal} | ${pctFmt(be.branchPct)} |`);
    lines.push(`| Functions | ${be.funcsCov} | ${be.funcsTotal} | ${pctFmt(be.funcsPct)} |`);
    lines.push(`| Lines | ${be.linesCov} | ${be.linesTotal} | ${pctFmt(be.linesPct)} |`);

    // Top 10 files needing coverage
    const top10 = beFiles
      .filter(f => f.missing > 0)
      .sort((a, b) => a.pct - b.pct || b.missing - a.missing)
      .slice(0, 10);

    if (top10.length > 0) {
      lines.push('');
      lines.push('**Top 10 — files needing coverage**');
      lines.push('');
      lines.push('| # | File | Covered | Total | % | Missing |');
      lines.push('|---|------|---------|-------|---|---------|');
      top10.forEach((f, i) => {
        lines.push(`| ${i + 1} | \`${f.path}\` | ${f.covered} | ${f.total} | ${dot(f.pct)} ${pctFmt(f.pct)} | ${f.missing} |`);
      });
    } else if (beFiles.length > 0) {
      lines.push('');
      lines.push('✅ All files fully covered.');
    }
  } else {
    lines.push('> ⚠️ Backend coverage data not available (job may have failed).');
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  // ── Frontend Unit Details ──
  lines.push('<details>');
  lines.push('<summary>▼ 🧪 Frontend Unit Details</summary>');
  lines.push('');
  if (fe) {
    lines.push('| Metric | Covered | Total | % |');
    lines.push('|--------|---------|-------|---|');
    lines.push(`| Statements | ${fe.stmts.covered} | ${fe.stmts.total} | ${pctFmt(fe.stmts.pct)} |`);
    lines.push(`| Branches | ${fe.branches.covered} | ${fe.branches.total} | ${pctFmt(fe.branches.pct)} |`);
    lines.push(`| Functions | ${fe.funcs.covered} | ${fe.funcs.total} | ${pctFmt(fe.funcs.pct)} |`);
    lines.push(`| Lines | ${fe.lines.covered} | ${fe.lines.total} | ${pctFmt(fe.lines.pct)} |`);

    // Top 10 files with most uncovered statements
    const top10 = feFiles
      .filter(f => f.missing > 0)
      .sort((a, b) => b.missing - a.missing || a.pct - b.pct)
      .slice(0, 10);

    if (top10.length > 0) {
      lines.push('');
      lines.push('**Top 10 — files with most uncovered statements**');
      lines.push('');
      lines.push('| # | File | Covered | Total | Stmts% | Branch% |');
      lines.push('|---|------|---------|-------|--------|---------|');
      top10.forEach((f, i) => {
        lines.push(`| ${i + 1} | \`${f.path}\` | ${f.covered} | ${f.total} | ${dot(f.pct)} ${pctFmt(f.pct)} | ${pctFmt(f.brPct)} |`);
      });
    } else if (feFiles.length > 0) {
      lines.push('');
      lines.push('✅ All files fully covered.');
    }
  } else {
    lines.push('> ⚠️ Frontend unit coverage data not available (job may have failed).');
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  // ── Frontend E2E Flow Details ──
  lines.push('<details>');
  lines.push('<summary>▼ 🎭 Frontend E2E Flow Details</summary>');
  lines.push('');
  if (e2e) {
    lines.push('| Status | Count |');
    lines.push('|--------|-------|');
    lines.push(`| ✅ Covered | ${e2e.covered} |`);
    lines.push(`| ⚠️ Partial | ${e2e.partial} |`);
    lines.push(`| ❌ Failing | ${e2e.failing} |`);
    lines.push(`| ⬜ Missing | ${e2e.missing} |`);
    lines.push(`| **Total** | **${e2e.total}** |`);

    // Failing flows
    const failing = e2eFlows.filter(f => f.status === 'failing');
    if (failing.length > 0) {
      lines.push('');
      lines.push('**❌ Failing Flows**');
      lines.push('');
      lines.push('| Flow | Module | Priority | Passed | Failed | Total |');
      lines.push('|------|--------|----------|--------|--------|-------|');
      for (const f of failing) {
        lines.push(`| ${f.name} | ${f.module} | ${f.priority} | ${f.tests.passed} | ${f.tests.failed} | ${f.tests.total} |`);
      }
    }

    // Partial flows
    const partial = e2eFlows.filter(f => f.status === 'partial');
    if (partial.length > 0) {
      lines.push('');
      lines.push('**⚠️ Partial Flows**');
      lines.push('');
      lines.push('| Flow | Module | Priority | Passed | Skipped | Total | Known Gaps |');
      lines.push('|------|--------|----------|--------|---------|-------|------------|');
      for (const f of partial) {
        const gaps = f.knownGaps.length > 0 ? f.knownGaps.join('; ') : '—';
        lines.push(`| ${f.name} | ${f.module} | ${f.priority} | ${f.tests.passed} | ${f.tests.skipped} | ${f.tests.total} | ${gaps} |`);
      }
    }

    // Missing flows (P1/P2/P3)
    const missing = e2eFlows.filter(f => f.status === 'missing');
    const missingP1 = missing.filter(f => f.priority === 'P1');
    const missingP2 = missing.filter(f => f.priority === 'P2');
    const missingP3 = missing.filter(f => f.priority === 'P3');

    if (missingP1.length > 0 || missingP2.length > 0 || missingP3.length > 0) {
      lines.push('');
      lines.push('**⬜ Missing Flows**');
      lines.push('');
      lines.push('| Priority | Flow | Module |');
      lines.push('|----------|------|--------|');
      for (const f of [...missingP1, ...missingP2, ...missingP3]) {
        lines.push(`| ${f.priority} | ${f.name} | ${f.module} |`);
      }
    }

    // If everything is clean
    if (failing.length === 0 && partial.length === 0 && missing.length === 0) {
      lines.push('');
      lines.push('✅ All flows fully covered — no failures, no gaps.');
    }
  } else {
    lines.push('> ⚠️ E2E flow coverage data not available (job may have failed).');
  }
  lines.push('');
  lines.push('</details>');
  lines.push('');

  // ── Footer ──
  lines.push('---');
  lines.push('');
  lines.push('*Generated by CI — Coverage Summary*');
  lines.push('');

  return lines.join('\n');
}

// ── Main ──

function main() {
  const backendData = readJSON(PATHS.backend);
  const unitData = readJSON(PATHS.unit);
  const e2eData = readJSON(PATHS.e2e);

  const be = extractBackend(backendData);
  const fe = extractUnit(unitData);
  const e2e = extractE2E(e2eData);

  const beFiles = extractBackendFiles(backendData);
  const feFiles = extractUnitFiles(unitData);
  const e2eFlows = extractE2EFlows(e2eData);

  const md = build(be, fe, e2e, beFiles, feFiles, e2eFlows);

  writeFileSync(OUTPUT, md, 'utf8');
  console.log(`Coverage report written to ${OUTPUT}`);
}

main();
