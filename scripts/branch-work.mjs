#!/usr/bin/env node
// Says whether the current branch holds implementation beyond the change's specification. Usage:
//   node scripts/branch-work.mjs --base dev --change 31-summary
// Prints {"implementation":true|false,"files":[...]}.   exit 0: there is code to correct   exit 1: only the specification   exit 2: bad arguments

import { execFileSync } from 'node:child_process';
import { hasImplementation } from './lib/branch-work.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const base = arg('base');
const change = arg('change');
if (!base || !change) {
  console.error('usage: branch-work.mjs --base <branch> --change <change folder name>');
  process.exit(2);
}
const paths = execFileSync('git', ['diff', '--name-only', `origin/${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
const result = hasImplementation(paths, `openspec/changes/${change}`);
console.log(JSON.stringify(result));
if (!result.implementation) {
  console.error('the branch holds only the specification: delete the remote branch and apply relevo:ready again');
  process.exit(1);
}
