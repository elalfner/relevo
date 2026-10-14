#!/usr/bin/env node
// Prints the label changes needed to move an issue to a state. Usage:
//   node scripts/label-change.mjs --to built --current "relevo:building,bug" [--config relevo.yml]
//   node scripts/label-change.mjs --clear --current "relevo:pr-open,bug"   (removes every Relevo label)
// Output: {"add":[...],"remove":[...]} using the label names from relevo.yml.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { clearAll, transition } from './lib/labels.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const to = arg('to');
const clear = process.argv.includes('--clear');
if (!to && !clear) {
  console.error('usage: label-change.mjs (--to <label-key> | --clear) --current "a,b" [--config path]');
  process.exit(2);
}
let overrides = {};
const path = resolve(arg('config') ?? 'relevo.yml');
if (existsSync(path)) {
  const loaded = loadConfig(readFileSync(path, 'utf8'));
  if (loaded.ok) overrides = loaded.config.labels;
}
try {
  const current = (arg('current') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  console.log(JSON.stringify(clear ? clearAll(current, overrides) : transition(current, to, overrides)));
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
