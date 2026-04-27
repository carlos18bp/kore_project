#!/usr/bin/env node
/**
 * CI helper: append E2E flow coverage summary to GITHUB_STEP_SUMMARY and
 * exit non-zero if any P1 flow is still "missing" in flow-coverage.json.
 *
 * See docs/E2E_FLOW_COVERAGE_REPORT_STANDARD.md (flow-coverage.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __file = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__file), '..');
const reportPath = path.join(ROOT, 'e2e-results', 'flow-coverage.json');
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

function appendSummary(md) {
  if (summaryPath) {
    fs.appendFileSync(summaryPath, md);
  } else {
    process.stdout.write(md);
  }
}

if (!fs.existsSync(reportPath)) {
  const msg = '\n_E2E flow coverage: `e2e-results/flow-coverage.json` not found (merge step may have failed or was skipped)._\n\n';
  appendSummary(msg);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
const s = data.summary || {};
const flows = data.flows || {};

const byStatus = (status) =>
  Object.entries(flows)
    .filter(([, f]) => f.status === status)
    .map(([id, f]) => ({ id, name: f.definition?.name || id, priority: f.definition?.priority || 'P4' }));

const missing = byStatus('missing');
const failing = byStatus('failing');
const partial = byStatus('partial');

let md = '## E2E user-flow coverage (`flow-coverage.json`)\n\n';
md += '| Metric | Count |\n| --- | ---: |\n';
md += `| Total flows | ${s.total ?? '—'} |\n`;
md += `| Covered | ${s.covered ?? '—'} |\n`;
md += `| Partial | ${s.partial ?? '—'} |\n`;
md += `| Failing | ${s.failing ?? '—'} |\n`;
md += `| Missing | ${s.missing ?? '—'} |\n`;

const missingP1 = missing.filter((f) => f.priority === 'P1');
const missingP2 = missing.filter((f) => f.priority === 'P2');
const missingP3 = missing.filter((f) => f.priority === 'P3');
if (missing.length > 0) {
  md += '\n### Missing by priority\n\n';
  if (missingP1.length) {
    md += '**P1**\n';
    for (const f of missingP1) md += `- \`${f.id}\` — ${f.name}\n`;
    md += '\n';
  }
  if (missingP2.length) {
    md += '**P2**\n';
    for (const f of missingP2.slice(0, 15)) md += `- \`${f.id}\` — ${f.name}\n`;
    if (missingP2.length > 15) md += `- _…and ${missingP2.length - 15} more_\n`;
    md += '\n';
  }
  if (missingP3.length) {
    md += '**P3**\n';
    for (const f of missingP3.slice(0, 10)) md += `- \`${f.id}\` — ${f.name}\n`;
    if (missingP3.length > 10) md += `- _…and ${missingP3.length - 10} more_\n`;
    md += '\n';
  }
}

if (failing.length > 0) {
  md += '### Failing flows\n\n';
  for (const f of failing.slice(0, 20)) {
    const t = flows[f.id]?.tests || {};
    md += `- \`${f.id}\` — ${f.name} (${t.failed ?? 0}/${t.total ?? 0} failed)\n`;
  }
  if (failing.length > 20) md += `- _…and ${failing.length - 20} more_\n`;
  md += '\n';
}

if (partial.length > 0 && partial.length <= 15) {
  md += '### Partial coverage\n\n';
  for (const f of partial) {
    const t = flows[f.id]?.tests || {};
    md += `- \`${f.id}\` — ${f.name} (${t.passed ?? 0}/${t.total ?? 0} passed)\n`;
  }
  md += '\n';
}

const unmapped = data.unmappedTests?.count ?? 0;
if (unmapped > 0) {
  md += `### Tests without \`@flow:\` tag\n\n${unmapped} test(s) — see full JSON artifact.\n\n`;
}

md += '_Artifact: `coverage-frontend-e2e` → `e2e-results/flow-coverage.json`._\n\n';
appendSummary(md);

if (missingP1.length > 0) {
  console.error('\n❌ CI gate: P1 flows with no E2E coverage (status missing):');
  for (const f of missingP1) console.error(`   - ${f.id}: ${f.name}`);
  console.error('');
  process.exit(1);
}

process.exit(0);
