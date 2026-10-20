#!/usr/bin/env node
// Keeps the work of a fix that QA rejected, and gives it back. Usage:
//   node scripts/fix-stash.mjs save --issue 42 --iteration 2   save the working tree (untracked files included)
//   node scripts/fix-stash.mjs find --issue 42                 print the newest stash of the issue as JSON
//   node scripts/fix-stash.mjs pop  --issue 42                 restore it; on a conflict it stays listed
//   node scripts/fix-stash.mjs drop --issue 42                 discard it (only after the person's written confirmation)
// exit 0: done   exit 1: nothing to do, or a conflict   exit 2: bad arguments

import { execFileSync } from 'node:child_process';
import { findStash, stashMessage } from './lib/fix-stash.mjs';

const [command] = process.argv.slice(2);
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const issue = arg('issue');
if (!['save', 'find', 'pop', 'drop'].includes(command) || !/^\d+$/.test(issue ?? '') || (command === 'save' && !/^\d+$/.test(arg('iteration') ?? ''))) {
  console.error('usage: fix-stash.mjs save --issue N --iteration K | find|pop|drop --issue N');
  process.exit(2);
}

if (command === 'save') {
  if (git('status', '--porcelain').trim() === '') {
    console.error('the working tree is clean: there is nothing to save');
    process.exit(1);
  }
  const message = stashMessage(issue, arg('iteration'));
  git('stash', 'push', '--include-untracked', '-m', message);
  console.log(`saved as "${message}". Resume with /relevo:fix ${issue}; the stash is local to this clone.`);
  process.exit(0);
}

const found = findStash(git('stash', 'list'), issue);
if (!found) {
  if (command === 'find') console.log('null');
  else console.error(`no saved fix for issue ${issue}`);
  process.exit(1);
}
if (command === 'find') {
  console.log(JSON.stringify(found));
  process.exit(0);
}
if (command === 'drop') {
  git('stash', 'drop', found.ref);
  console.log(`dropped "${found.message}"`);
  process.exit(0);
}
try {
  git('stash', 'pop', found.ref);
  console.log(`restored "${found.message}"`);
} catch (error) {
  const files = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
  console.error(`restoring "${found.message}" conflicts with the branch in: ${files.join(', ') || 'unknown files'}. The stash is kept.`);
  process.exit(1);
}
