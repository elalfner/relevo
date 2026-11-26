#!/usr/bin/env node
// Checks that the delta of a change still fits the main specifications it will be archived into, so `openspec archive`
// does not stop on it later. It only reads. Usage:
//   node scripts/delta-check.mjs --change 31-summary [--base origin/dev] [--issue 31] [--json]
// Without --base the main specifications are read from the working tree (what the archive will see); with it, from that
// git ref (what the branch will meet when it is merged). Prints one line per clash (or JSON with --json) and nothing
// when there are none.   exit 0: fits   exit 1: clashes   exit 2: bad arguments, no such change or no such ref

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkDelta, describeClashes } from './lib/delta-check.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const change = arg('change');
const base = arg('base');
const issue = arg('issue');
const json = process.argv.includes('--json');
if (!change) fail('usage: delta-check.mjs --change <change folder name> [--base <git ref>] [--issue <number>] [--json]');

const changeDir = join('openspec', 'changes', change);
if (!existsSync(changeDir)) fail(`there is no change folder ${changeDir}`);

if (base) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], { stdio: 'ignore' });
  } catch {
    fail(`the git ref ${base} does not exist`);
  }
}

const specsDir = join(changeDir, 'specs');
const capabilities = [];
const walk = (rel) => {
  const dir = join(specsDir, rel);
  if (!existsSync(dir)) return;
  readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((entry) => {
    const path = join(rel, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name === 'spec.md' && rel) capabilities.push({ capability: rel, delta: readFileSync(join(specsDir, path), 'utf8') });
  });
};
walk('');

const readMain = (capability) => {
  const path = join('openspec', 'specs', capability, 'spec.md');
  if (!base) return existsSync(path) ? readFileSync(path, 'utf8') : null;
  try {
    return execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
};

const { clashes } = checkDelta({ capabilities, readMain });
if (json) console.log(JSON.stringify({ change, base: base ?? null, clashes }));
else if (clashes.length > 0) console.log(describeClashes(clashes, { issue }));
process.exit(clashes.length > 0 ? 1 : 0);
