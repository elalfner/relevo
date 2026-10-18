#!/usr/bin/env node
// Tells whether an issue's description may be rewritten. Usage:
//   gh issue view 42 --json number,title,body,state,labels | node scripts/can-edit-issue.mjs [--input issue.json] [--config relevo.yml]
// Prints `editable`, or `refused: <label> - <reason>` (the label is left out when the issue is closed).
// exit 0: editable   exit 1: refused   exit 2: bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { canEditIssue } from './lib/can-edit-issue.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (m) => {
  console.error(m);
  process.exit(2);
};

let issue;
try {
  issue = JSON.parse(readFileSync(arg('input') ?? 0, 'utf8'));
} catch (err) {
  fail(`cannot read the issue JSON: ${err.message}`);
}
if (!issue || typeof issue !== 'object' || !Array.isArray(issue.labels) || typeof issue.state !== 'string') {
  fail('the JSON must come from `gh issue view --json number,title,body,state,labels`');
}

let overrides = {};
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (existsSync(configPath)) {
  const loaded = loadConfig(readFileSync(configPath, 'utf8'));
  if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
  overrides = loaded.config.labels ?? {};
}

const r = canEditIssue(issue, overrides);
if (r.editable) {
  console.log('editable');
  process.exit(0);
}
console.log(`refused: ${r.label ? `${r.label} - ` : ''}${r.reason}`);
process.exit(1);
