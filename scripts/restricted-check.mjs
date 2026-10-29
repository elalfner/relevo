#!/usr/bin/env node
// Fails when a restricted file is versioned, by path name: it lists the files git tracks and never opens one. Usage:
//   node scripts/restricted-check.mjs [--ref origin/dev] [--config relevo.yml]
// Without --ref it lists the files of the index (`git ls-files`); with it, the files of that commit (`git ls-tree`), which
// is how `go` checks the base branch before it builds. A versioned secret is already in the history, so a run that
// meets one ends in `qa-failed` with the reason "restricted file in the diff" instead of building around it.
//   exit 0: none versioned   exit 1: prints each path and the rule   exit 2: bad arguments or git failed

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { RESTRICTED_REASON, checkRestricted, restrictedListFromText } from './lib/restricted-paths.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const configPath = opt('config') ?? 'relevo.yml';
// Read from the text: a relevo.yml that does not validate still restricts what it lists.
const list = restrictedListFromText(existsSync(configPath) ? readFileSync(configPath, 'utf8') : '');

let tracked;
try {
  const args = opt('ref') ? ['ls-tree', '-r', '--name-only', '-z', opt('ref')] : ['ls-files', '-z'];
  tracked = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 }).split('\0').filter(Boolean);
} catch (err) {
  fail(`git could not list the files${err.stderr ? `: ${String(err.stderr).trim()}` : ''}`);
}

const { ok, violations } = checkRestricted(tracked, list);
if (ok) {
  console.log('no restricted file is versioned');
  process.exit(0);
}
console.error(violations.map((v) => `${v.path}  ${RESTRICTED_REASON}: versioned (${v.rule}); a secret in the history must be rotated, and the file removed from the repository`).join('\n'));
process.exit(1);
