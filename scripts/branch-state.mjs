#!/usr/bin/env node
// Says what a feature branch on the remote holds. Usage:
//   node scripts/branch-state.mjs <base> <branch> <change_id>
// Prints one word: absent (no such branch), empty, spec-only or implementation.
// spec-only means every changed path is under openspec/changes/<change_id>/.
//   node scripts/branch-state.mjs --merge <base> <branch>
// Prints JSON { result, files }: would merging the base into the branch conflict? `clean`, `conflict` (with the files)
// or `unknown` (a git older than 2.38 cannot probe). The tree is not touched.
// exit 0: printed   exit 2: bad arguments or git failed

import { execFileSync, spawnSync } from 'node:child_process';
import { probeMerge } from './lib/merge-probe.mjs';
import { classifyBranchChanges } from './lib/branch.mjs';

const args = process.argv.slice(2);
if (args[0] === '--merge') {
  const [, base, branch] = args;
  if (!base || !branch) {
    console.error('usage: branch-state.mjs --merge <base> <branch>');
    process.exit(2);
  }
  try {
    execFileSync('git', ['fetch', '--quiet', 'origin', base, branch], { stdio: 'ignore' });
  } catch {
    console.log(JSON.stringify({ result: 'unknown', files: [] }));
    process.exit(0);
  }
  const run = (...a) => spawnSync('git', a, { encoding: 'utf8' });
  console.log(JSON.stringify(probeMerge(run, `origin/${base}`, `origin/${branch}`)));
  process.exit(0);
}
const [base, branch, id] = args;
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
