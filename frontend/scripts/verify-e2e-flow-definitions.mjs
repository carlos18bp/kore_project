#!/usr/bin/env node
/**
 * Ensures every key in e2e/flow-definitions.json appears as @flow:<id> somewhere
 * under e2e/, and every @flow:<id> in that tree is defined in the JSON.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..');
const e2eDir = join(frontendRoot, 'e2e');
const flowJsonPath = join(e2eDir, 'flow-definitions.json');

const data = JSON.parse(readFileSync(flowJsonPath, 'utf8'));
const defined = new Set(Object.keys(data.flows ?? {}));

function walkTsFiles(dir, list = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(p, list);
    } else if (entry.name.endsWith('.ts')) {
      list.push(p);
    }
  }
  return list;
}

const tags = new Set();
const flowTagRe = /@flow:([a-z0-9-]+)/g;
for (const file of walkTsFiles(e2eDir)) {
  const text = readFileSync(file, 'utf8');
  let m;
  while ((m = flowTagRe.exec(text)) !== null) {
    tags.add(m[1]);
  }
}

const missingTags = [...defined].filter((id) => !tags.has(id)).sort();
const orphanTags = [...tags].filter((id) => !defined.has(id)).sort();

if (missingTags.length > 0 || orphanTags.length > 0) {
  console.error('flow-definitions.json ↔ @flow: mismatch under e2e/');
  if (missingTags.length > 0) {
    console.error(`  In JSON but no @flow tag in e2e/**/*.ts (${missingTags.length}):`);
    missingTags.forEach((id) => console.error(`    - ${id}`));
  }
  if (orphanTags.length > 0) {
    console.error(`  @flow tags not in flow-definitions.json (${orphanTags.length}):`);
    orphanTags.forEach((id) => console.error(`    - ${id}`));
  }
  process.exit(1);
}

console.log(`OK: ${defined.size} E2E flow IDs aligned (flow-definitions.json ↔ @flow tags).`);
