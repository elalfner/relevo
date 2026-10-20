#!/usr/bin/env node
// Says what a feature branch on the remote holds. Usage:
//   node scripts/branch-state.mjs <base> <branch> <change_id>
// Prints one word: absent (no such branch), empty, spec-only or implementation.
// spec-only means every changed path is under openspec/changes/<change_id>/. exit 0: printed   exit 2: bad arguments or git failed

import { execFileSync } from 'node:child_process';
import { classifyBranchChanges } from './lib/branch.mjs';

const [base, branch, id] = process.argv.slice(2);
if (!base || !branch || !id) {
  console.error('usage: branch-state.mjs <base> <branch> <change_id>');
  process.exit(2);
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  // The branch may not exist: fetching it then fails, which is the answer.
  try {
    git('fetch', '--quiet', 'origin', base, branch);
  } catch {
    git('fetch', '--quiet', 'origin', base);
    console.log('absent');
    process.exit(0);
  }
  const paths = git('diff', '--name-only', `origin/${base}...origin/${branch}`).split('\n');
  console.log(classifyBranchChanges(paths, id));
} catch (err) {
  console.error(`could not read the branch: ${(err.stderr || err.message).toString().trim()}`);
  process.exit(2);
}
