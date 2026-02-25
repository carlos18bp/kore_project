import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleFilename = fileURLToPath(import.meta.url);
const moduleDirname = path.dirname(moduleFilename);

const DEFAULT_DEFINITIONS_PATH = path.resolve(moduleDirname, '..', 'flow-definitions.json');
const DEFAULT_OUTPUT_DIR = 'e2e-results';
const DEFAULT_OUTPUT_FILE = 'flow-coverage.json';
const FLOW_TAG_PREFIX = '@flow:';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  orange: '\x1b[38;5;208m',
  gray: '\x1b[90m',
};

function resolvePath(targetPath) {
  if (!targetPath) return undefined;
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.join(process.cwd(), targetPath);
}

function emptyDefinitions() {
  return { version: '0.0.0', lastUpdated: '', flows: {} };
}

function normalizeDefinitions(data) {
  if (!data) return emptyDefinitions();

  if (data.flows && !Array.isArray(data.flows) && typeof data.flows === 'object') {
    return {
      version: data.version || '0.0.0',
      lastUpdated: data.lastUpdated || '',
      flows: data.flows,
    };
  }

  if (Array.isArray(data.flows)) {
    const flows = {};
    for (const flow of data.flows) {
      if (!flow?.id) continue;
      const { id, ...definition } = flow;
      flows[id] = definition;
    }

    return {
      version: data.version || '0.0.0',
      lastUpdated: data.lastUpdated || '',
      flows,
    };
  }

  return emptyDefinitions();
}

function readFlowDefinitions(definitionsPath) {
  const resolvedPath = resolvePath(definitionsPath) || DEFAULT_DEFINITIONS_PATH;
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    console.warn('\n  ⚠️  flow-definitions.json not found. Flow coverage will be limited.\n');
    return { definitions: emptyDefinitions(), sourcePath: resolvedPath };
  }

  try {
    const data = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
    return { definitions: normalizeDefinitions(data), sourcePath: resolvedPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`\n  ⚠️  flow-definitions.json could not be parsed: ${message}\n`);
    return { definitions: emptyDefinitions(), sourcePath: resolvedPath };
  }
}

class FlowCoverageReporter {
  constructor(options = {}) {
    this.definitionsPath = options.definitionsPath || DEFAULT_DEFINITIONS_PATH;
    this.outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
    this.outputFile = options.outputFile || DEFAULT_OUTPUT_FILE;
    this.printDetails = options.printDetails !== false;

    this.flowDefinitions = emptyDefinitions();
    this.flowStats = new Map();
    this.knownFlowIds = new Set();
    this.unmappedTests = [];
    this.unknownFlowTags = [];
    this.definitionsSourcePath = undefined;

    const { definitions, sourcePath } = readFlowDefinitions(this.definitionsPath);
    this.flowDefinitions = definitions;
    this.definitionsSourcePath = sourcePath;

    for (const [flowId, definition] of Object.entries(definitions.flows)) {
      this.knownFlowIds.add(flowId);
      this.flowStats.set(flowId, this.createFlowStat(flowId, definition, false));
    }
  }

  createFlowStat(flowId, definition, isUnknown) {
    return {
      flowId,
      definition,
      tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
      specs: new Set(),
      status: 'missing',
      isUnknown,
    };
  }

  onTestEnd(test, result) {
    const tags = test.tags || [];
    const flowTags = tags.filter((tag) => tag.startsWith(FLOW_TAG_PREFIX));
    const specFile = test.location?.file || 'unknown';

    if (flowTags.length === 0) {
      this.unmappedTests.push({ title: test.title, file: specFile });
      return;
    }

    for (const tag of flowTags) {
      const flowId = tag.slice(FLOW_TAG_PREFIX.length);
      let stats = this.flowStats.get(flowId);

      if (!stats) {
        stats = this.createFlowStat(
          flowId,
          {
            name: flowId,
            module: 'unknown',
            roles: ['unknown'],
            priority: 'P4',
            description: 'Auto-detected flow (not in definitions)',
            expectedSpecs: 1,
          },
          true
        );
        this.flowStats.set(flowId, stats);
      }

      if (stats.isUnknown) {
        this.unknownFlowTags.push({ tag, test: { title: test.title, file: specFile } });
      }

      stats.tests.total += 1;
      stats.specs.add(specFile);

      switch (result.status) {
        case 'passed':
          stats.tests.passed += 1;
          break;
        case 'skipped':
          stats.tests.skipped += 1;
          break;
        case 'failed':
        case 'timedOut':
        case 'interrupted':
          stats.tests.failed += 1;
          break;
        default:
          break;
      }
    }
  }

  computeStatus(stats) {
    if (stats.tests.total === 0 || stats.tests.skipped === stats.tests.total) {
      return 'missing';
    }
    if (stats.tests.failed > 0) {
      return 'failing';
    }
    if (stats.tests.passed > 0 && stats.tests.skipped > 0) {
      return 'partial';
    }
    return 'covered';
  }

  buildReport() {
    const flowEntries = Array.from(this.flowStats.values()).map((stats) => {
      const status = this.computeStatus(stats);
      return {
        id: stats.flowId,
        ...stats.definition,
        status,
        tests: stats.tests,
        specs: Array.from(stats.specs).sort(),
        isUnknown: stats.isUnknown,
      };
    });

    const knownFlows = flowEntries.filter((flow) => !flow.isUnknown);
    const unknownFlows = flowEntries.filter((flow) => flow.isUnknown);

    const totals = {
      total: knownFlows.length,
      covered: 0,
      partial: 0,
      missing: 0,
      failing: 0,
    };

    for (const flow of knownFlows) {
      totals[flow.status] += 1;
    }

    const coveredPercent = totals.total
      ? Number(((totals.covered / totals.total) * 100).toFixed(1))
      : 0;

    const outputDir = resolvePath(this.outputDir) || path.join(process.cwd(), DEFAULT_OUTPUT_DIR);
    const outputPath = path.join(outputDir, this.outputFile);

    return {
      generatedAt: new Date().toISOString(),
      definitionsPath: this.definitionsSourcePath,
      outputPath,
      summary: {
        totals,
        coveredPercent,
      },
      flows: knownFlows,
      unknownFlows,
      unmappedTests: this.unmappedTests,
      unknownFlowTags: this.unknownFlowTags,
    };
  }

  progressBar(covered, total, width = 20) {
    if (!total) {
      return `[${'-'.repeat(width)}]`;
    }
    const filledLength = Math.round((covered / total) * width);
    const filled = '#'.repeat(filledLength);
    const empty = '-'.repeat(Math.max(width - filledLength, 0));
    return `[${filled}${empty}]`;
  }

  writeJsonReport(report) {
    const outputDir = resolvePath(this.outputDir) || path.join(process.cwd(), DEFAULT_OUTPUT_DIR);
    const outputPath = path.join(outputDir, this.outputFile);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  }

  printReport(report) {
    const { totals, coveredPercent } = report.summary;
    const flows = report.flows;

    const covered = flows.filter((flow) => flow.status === 'covered');
    const partial = flows.filter((flow) => flow.status === 'partial');
    const failing = flows.filter((flow) => flow.status === 'failing');
    const missing = flows.filter((flow) => flow.status === 'missing');

    const missingP1 = missing.filter((flow) => flow.priority === 'P1');
    const missingP2 = missing.filter((flow) => flow.priority === 'P2');
    const missingP3 = missing.filter((flow) => flow.priority === 'P3');

    console.log('');
    console.log(`${ANSI.bold}╔══════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
    console.log(`${ANSI.bold}║                    FLOW COVERAGE REPORT                         ║${ANSI.reset}`);
    console.log(`${ANSI.bold}╚══════════════════════════════════════════════════════════════════╝${ANSI.reset}`);
    console.log('');

    console.log(`${ANSI.bold}📊 SUMMARY${ANSI.reset}`);
    console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
    console.log(`   Total Flows Defined:  ${ANSI.bold}${totals.total}${ANSI.reset}`);
    console.log(`   ${ANSI.green}✅ Covered:${ANSI.reset}           ${covered.length} (${coveredPercent}%)`);
    console.log(`   ${ANSI.yellow}⚠️  Partial:${ANSI.reset}           ${partial.length} (${totals.total ? ((partial.length / totals.total) * 100).toFixed(1) : '0.0'}%)`);
    console.log(`   ${ANSI.red}❌ Failing:${ANSI.reset}           ${failing.length} (${totals.total ? ((failing.length / totals.total) * 100).toFixed(1) : '0.0'}%)`);
    console.log(`   ${ANSI.gray}⬜ Missing:${ANSI.reset}           ${missing.length} (${totals.total ? ((missing.length / totals.total) * 100).toFixed(1) : '0.0'}%)`);
    console.log('');

    if (missing.length > 0) {
      console.log(`${ANSI.bold}🚨 MISSING FLOWS BY PRIORITY${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);

      if (missingP1.length > 0) {
        console.log(`   ${ANSI.red}🔴 P1 (Critical): ${missingP1.length}${ANSI.reset}`);
        for (const flow of missingP1) {
          console.log(`      ${ANSI.dim}-${ANSI.reset} ${flow.id}: ${flow.name}`);
        }
      }

      if (missingP2.length > 0) {
        console.log(`   ${ANSI.orange}🟠 P2 (High): ${missingP2.length}${ANSI.reset}`);
        for (const flow of missingP2) {
          console.log(`      ${ANSI.dim}-${ANSI.reset} ${flow.id}: ${flow.name}`);
        }
      }

      if (missingP3.length > 0) {
        console.log(`   ${ANSI.yellow}🟡 P3 (Medium): ${missingP3.length}${ANSI.reset}`);
        for (const flow of missingP3) {
          console.log(`      ${ANSI.dim}-${ANSI.reset} ${flow.id}: ${flow.name}`);
        }
      }
      console.log('');
    }

    if (failing.length > 0) {
      console.log(`${ANSI.bold}❌ FAILING FLOWS${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
      for (const flow of failing) {
        console.log(`   ${ANSI.red}${flow.id}${ANSI.reset}: ${flow.tests.failed}/${flow.tests.total} failed`);
      }
      console.log('');
    }

    if (partial.length > 0) {
      console.log(`${ANSI.bold}⚠️  PARTIAL COVERAGE${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
      for (const flow of partial) {
        const testPct = flow.tests.total > 0
          ? ((flow.tests.passed / flow.tests.total) * 100).toFixed(0)
          : '0';
        console.log(`   ${ANSI.yellow}${flow.id}${ANSI.reset}: ${testPct}% (${flow.tests.passed}/${flow.tests.total})`);
        if (flow.knownGaps) {
          for (const gap of flow.knownGaps) {
            console.log(`      ${ANSI.dim}└─ Gap: ${gap}${ANSI.reset}`);
          }
        }
      }
      console.log('');
    }

    console.log(`${ANSI.bold}📦 COVERAGE BY MODULE${ANSI.reset}`);
    console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);

    const moduleTotals = new Map();
    for (const flow of flows) {
      const moduleName = flow.module || 'unknown';
      if (!moduleTotals.has(moduleName)) {
        moduleTotals.set(moduleName, { covered: 0, total: 0 });
      }
      const stats = moduleTotals.get(moduleName);
      stats.total += 1;
      if (flow.status === 'covered') stats.covered += 1;
    }

    const sortedModules = Array.from(moduleTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [moduleName, stats] of sortedModules) {
      const modulePct = stats.total > 0 ? Math.round((stats.covered / stats.total) * 100) : 0;
      const bar = this.progressBar(stats.covered, stats.total, 20);
      let color = ANSI.red;
      if (modulePct >= 80) color = ANSI.brightGreen;
      else if (modulePct >= 60) color = ANSI.green;
      else if (modulePct >= 40) color = ANSI.yellow;
      else if (modulePct >= 20) color = ANSI.orange;

      console.log(
        `   ${moduleName.padEnd(18)} ${color}${bar}${ANSI.reset} ` +
        `${color}${modulePct}%${ANSI.reset} (${stats.covered}/${stats.total})`
      );
    }
    console.log('');

    if (report.unknownFlowTags.length > 0) {
      console.log(`${ANSI.bold}⚠️  UNKNOWN FLOW TAGS${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
      for (const entry of report.unknownFlowTags) {
        const shortFile = entry.test.file.split('/').slice(-2).join('/');
        console.log(`   ${ANSI.dim}${entry.tag} (${shortFile})${ANSI.reset}`);
      }
      console.log('');
    }

    if (report.unmappedTests.length > 0) {
      console.log(`${ANSI.bold}⚠️  TESTS WITHOUT FLOW TAG${ANSI.reset}`);
      console.log(`${ANSI.dim}${'─'.repeat(50)}${ANSI.reset}`);
      console.log(`   ${report.unmappedTests.length} tests are not tagged with @flow:`);

      const grouped = new Map();
      for (const test of report.unmappedTests) {
        grouped.set(test.file, (grouped.get(test.file) || 0) + 1);
      }

      const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 15);
      for (const [file, count] of top) {
        const shortFile = file.split('/').slice(-2).join('/');
        console.log(`      ${ANSI.dim}${shortFile}: ${count} tests${ANSI.reset}`);
      }
      if (sorted.length > 15) {
        console.log(`      ${ANSI.dim}... and ${sorted.length - 15} more${ANSI.reset}`);
      }
      console.log('');
    }

    console.log(`${ANSI.dim}Flow coverage report written to ${report.outputPath}${ANSI.reset}`);
    console.log('');
  }

  onEnd() {
    const report = this.buildReport();
    this.writeJsonReport(report);
    if (this.printDetails) {
      this.printReport(report);
    }
  }
}

export default FlowCoverageReporter;
