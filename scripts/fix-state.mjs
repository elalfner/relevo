#!/usr/bin/env node
// Prints what a fix does to an issue's labels. Usage:
//   node scripts/fix-state.mjs --current "relevo:qa-failed,bug" [--config relevo.yml]
// Output: {"allowed":true,"from":"qa-failed","to":"built","notify":"assignee","labels":{"add":[...],"remove":[...]}}
//   exit 0: a fix may run   exit 1: not allowed in this state   exit 2: bad arguments

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { fixOutcome } from './lib/fix.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
if (arg('current') === undefined) {
  console.error('usage: fix-state.mjs --current "label,label" [--config relevo.yml]');
  process.exit(2);
}
let overrides = {};
const path = resolve(arg('config') ?? 'relevo.yml');
if (existsSync(path)) {
  const loaded = loadConfig(readFileSync(path, 'utf8'));
  if (loaded.ok) overrides = loaded.config.labels;
}
const result = fixOutcome(arg('current').split(',').map((s) => s.trim()).filter(Boolean), overrides);
console.log(JSON.stringify(result));
process.exit(result.allowed ? 0 : 1);
