import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type FlowDefinitions = Record<string, {
  name: string;
  module: string;
  priority: string;
  roles: string[];
  description: string;
  expectedSpecs?: number;
  knownGaps?: string[];
}>;

type FlowResult = {
  tag: string;
  title: string;
  status: 'passed' | 'skipped' | 'failed';
  file: string;
};

const summaryFlowDefinitions: FlowDefinitions = {
  'flow-a': {
    name: 'Flow A',
    module: 'auth',
    priority: 'P1',
    roles: ['guest'],
    description: 'Auth flow',
  },
  'flow-b': {
    name: 'Flow B',
    module: 'booking',
    priority: 'P2',
    roles: ['user'],
    description: 'Booking flow',
  },
  'flow-c': {
    name: 'Flow C',
    module: 'checkout',
    priority: 'P3',
    roles: ['user'],
    description: 'Checkout flow',
  },
};

const summaryFlowResults: FlowResult[] = [
  { tag: '@flow:flow-a', title: 'Flow A pass', status: 'passed', file: 'e2e/flow-a.spec.ts' },
  { tag: '@flow:flow-a', title: 'Flow A skip', status: 'skipped', file: 'e2e/flow-a.spec.ts' },
  { tag: '@flow:flow-b', title: 'Flow B fail', status: 'failed', file: 'e2e/flow-b.spec.ts' },
];

const applyFlowResults = (
  reporter: {
    onTestEnd: (
      test: { tags: string[]; title: string; location: { file: string } },
      result: { status: FlowResult['status'] }
    ) => void;
  },
  results: FlowResult[]
) => {
  results.forEach(({ tag, title, status, file }) => {
    reporter.onTestEnd(
      { tags: [tag], title, location: { file } },
      { status }
    );
  });
};

async function loadReporter() {
  const reporterModule = await import('../../../e2e/reporters/flow-coverage-reporter.mjs');
  return reporterModule.default;
}

describe('flow reporter', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-reporter-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const writeDefinitions = (flows: FlowDefinitions) => {
    const definitionsPath = path.join(tempDir, 'flow-definitions.json');
    const payload = {
      version: '1.0.0',
      lastUpdated: '2026-02-23',
      flows,
    };
    fs.writeFileSync(definitionsPath, JSON.stringify(payload), 'utf-8');
    return definitionsPath;
  };

  const createReporter = async (flows: FlowDefinitions) => {
    const definitionsPath = writeDefinitions(flows);
    const outputDir = path.join(tempDir, 'results');
    const FlowCoverageReporter = await loadReporter();
    const reporter = new FlowCoverageReporter({
      definitionsPath,
      outputDir,
      outputFile: 'flow-coverage.json',
      printDetails: false,
    });
    return { reporter, outputDir };
  };

  it('buildReport summarizes flow status totals', async () => {
    const { reporter } = await createReporter(summaryFlowDefinitions);
    applyFlowResults(reporter, summaryFlowResults);

    const report = reporter.buildReport();

    expect(report.summary.totals).toEqual({
      total: 3,
      covered: 0,
      partial: 1,
      missing: 1,
      failing: 1,
    });
    expect(report.flows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'flow-a', status: 'partial' }),
      expect.objectContaining({ id: 'flow-b', status: 'failing' }),
      expect.objectContaining({ id: 'flow-c', status: 'missing' }),
    ]));
  });

  it('buildReport records unknown flow tags', async () => {
    const { reporter } = await createReporter({
      'flow-known': {
        name: 'Known Flow',
        module: 'auth',
        priority: 'P1',
        roles: ['guest'],
        description: 'Known flow',
      },
    });

    reporter.onTestEnd(
      { tags: ['@flow:flow-unknown'], title: 'Unknown flow', location: { file: 'e2e/unknown.spec.ts' } },
      { status: 'passed' }
    );
    reporter.onTestEnd(
      { tags: [], title: 'Untagged', location: { file: 'e2e/untagged.spec.ts' } },
      { status: 'passed' }
    );

    const report = reporter.buildReport();

    expect(report.summary.totals).toEqual({
      total: 1,
      covered: 0,
      partial: 0,
      missing: 1,
      failing: 0,
    });
    expect(report.unknownFlows).toHaveLength(1);
    expect(report.unknownFlowTags).toHaveLength(1);
    expect(report.unmappedTests).toHaveLength(1);
  });

  it('writeJsonReport persists report output file', async () => {
    const { reporter, outputDir } = await createReporter({
      'flow-json': {
        name: 'Flow Json',
        module: 'public',
        priority: 'P2',
        roles: ['guest'],
        description: 'Json flow',
      },
    });

    reporter.onTestEnd(
      { tags: ['@flow:flow-json'], title: 'Flow Json pass', location: { file: 'e2e/flow-json.spec.ts' } },
      { status: 'passed' }
    );

    const report = reporter.buildReport();
    reporter.writeJsonReport(report);

    const outputPath = path.join(outputDir, 'flow-coverage.json');
    const storedReport = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));

    expect(storedReport.summary.totals.total).toBe(1);
    expect(storedReport.flows[0].id).toBe('flow-json');
  });
});
