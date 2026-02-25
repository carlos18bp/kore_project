import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const e2eModules = require('../../../scripts/e2e-modules.cjs');
const e2eModule = require('../../../scripts/e2e-module.cjs');
const e2eCoverageModule = require('../../../scripts/e2e-coverage-module.cjs');

type FlowDefinition = {
  module?: string;
};

type FlowDefinitions = {
  flows: Record<string, FlowDefinition>;
};

const tempDirs: string[] = [];

function createDefinitionsFile(data: FlowDefinitions) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-modules-'));
  const filePath = path.join(tempDir, 'flow-definitions.json');
  fs.writeFileSync(filePath, JSON.stringify({ version: '1.0.0', lastUpdated: '2026-02-24', ...data }), 'utf8');
  tempDirs.push(tempDir);
  return filePath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('e2e module scripts', () => {
  it('loadModules returns sorted unique modules', () => {
    const filePath = createDefinitionsFile({
      flows: {
        'auth-login': { module: 'auth' },
        'auth-logout': { module: 'auth' },
        'booking-flow': { module: ' booking ' },
        'empty-module': { module: '' },
      },
    });

    expect(e2eModules.loadModules(filePath)).toEqual(['auth', 'booking']);
  });

  it('loadModules throws when flow definitions file is missing', () => {
    const missingPath = path.join(os.tmpdir(), 'missing-flow-definitions.json');

    expect(() => e2eModules.loadModules(missingPath)).toThrow('Unable to read flow definitions');
  });

  it('loadModules throws when flow definitions JSON is invalid', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-modules-'));
    const filePath = path.join(tempDir, 'flow-definitions.json');
    fs.writeFileSync(filePath, '{ invalid', 'utf8');
    tempDirs.push(tempDir);

    expect(() => e2eModules.loadModules(filePath)).toThrow('Invalid JSON');
  });

  it('printModules warns when no modules are defined', () => {
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    e2eModules.printModules([], logger);

    expect(logger.warn).toHaveBeenCalledWith('[e2e:modules] No modules found in flow-definitions.json.');
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('printModules logs module names when available', () => {
    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
    };

    e2eModules.printModules(['auth', 'booking'], logger);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenNthCalledWith(1, 'auth');
    expect(logger.log).toHaveBeenNthCalledWith(2, 'booking');
  });

  it('validateModuleName returns modules for known module', () => {
    const filePath = createDefinitionsFile({
      flows: {
        'auth-login': { module: 'auth' },
        'booking-flow': { module: 'booking' },
      },
    });

    const modules = e2eModule.validateModuleName('auth', filePath);

    expect(modules).toEqual(['auth', 'booking']);
  });

  it('validateModuleName throws for unknown module', () => {
    const filePath = createDefinitionsFile({
      flows: {
        'auth-login': { module: 'auth' },
      },
    });

    expect(() => e2eCoverageModule.validateModuleName('unknown', filePath)).toThrow('Unknown module');
  });

  it('resolveOptions parses module with extra args', () => {
    const options = e2eModule.resolveOptions(['@module:auth', '--project=Desktop Chrome']);

    expect(options).toEqual({
      moduleName: 'auth',
      extraArgs: ['--project=Desktop Chrome'],
    });
  });

  it('buildModuleArgs builds module grep command args', () => {
    const args = e2eModule.buildModuleArgs('auth', ['--project=Desktop Chrome']);

    expect(args).toEqual(['run', 'e2e', '--', '--grep', '@module:auth', '--project=Desktop Chrome']);
  });

  it('buildCoverageArgs builds coverage module grep command args', () => {
    const args = e2eCoverageModule.buildCoverageArgs('auth', ['--project=Tablet']);

    expect(args).toEqual(['run', 'e2e:coverage', '--', '--grep', '@module:auth', '--project=Tablet']);
  });
});
