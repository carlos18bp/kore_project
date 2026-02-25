'use strict';

const { spawnSync } = require('node:child_process');
const { loadModules } = require('./e2e-modules.cjs');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const usage = `Usage:
  npm run e2e:module -- <module> [playwright args...]

Examples:
  npm run e2e:module -- auth
  npm run e2e:module -- @module:auth
  npm run e2e:module -- auth --project="Desktop Chrome"`;

function normalizeModuleName(value) {
  const trimmed = value.trim();
  return trimmed.startsWith('@module:') ? trimmed.slice('@module:'.length) : trimmed;
}

function resolveOptions(argv) {
  if (!argv || argv.length === 0) {
    throw new Error('Module name is required.');
  }

  const [rawName, ...extraArgs] = argv;
  const moduleName = normalizeModuleName(rawName);
  if (!moduleName) {
    throw new Error('Module name is required.');
  }

  return { moduleName, extraArgs };
}

function validateModuleName(moduleName, definitionsFile) {
  const modules = loadModules(definitionsFile);
  if (!modules.includes(moduleName)) {
    const available = modules.length > 0 ? modules.join(', ') : 'none';
    throw new Error(`Unknown module "${moduleName}". Available modules: ${available}.`);
  }
  return modules;
}

function buildModuleArgs(moduleName, extraArgs) {
  return ['run', 'e2e', '--', '--grep', `@module:${moduleName}`, ...extraArgs];
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: process.cwd() });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function run() {
  try {
    const options = resolveOptions(process.argv.slice(2));
    validateModuleName(options.moduleName);
    runCommand(npmCommand, buildModuleArgs(options.moduleName, options.extraArgs));
  } catch (error) {
    console.error(`[e2e:module] ${error.message}`);
    console.error(usage);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  buildModuleArgs,
  normalizeModuleName,
  resolveOptions,
  validateModuleName,
};
