#!/usr/bin/env node
// Can this run continue from the branch of its issue? Usage:
//   node scripts/resume-check.mjs <base> <branch> <issue> <issue_hash>
// Fetches the base and the branch from origin and prints JSON { state, reason, commits, checkpoints, tip }:
//   absent    no such branch on the remote: create it from the base
//   resume    every commit over the base is Relevo's own for this issue, the tip is a checkpoint or the work kept at a limit,
//             and the tip carries the hash of the issue text, which has not changed: continue from the branch
//   existing  anything else: stop with the reason `branch already exists`
//   exit 0: printed   exit 2: bad arguments

import { execFileSync } from 'node:child_process';
import { resumeState } from './lib/resume-check.mjs';

const [base, branch, issueArg, issueHash] = process.argv.slice(2);
const issue = /^\d{1,9}$/.test(issueArg ?? '') ? Number(issueArg) : null;
if (!base || !branch || issue === null) {
  console.error('usage: resume-check.mjs <base> <branch> <issue> <issue_hash>');
  process.exit(2);
}
const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
let result;
try {
  // `ls-remote` first: fetching a branch that is not there is an error, and "absent" is an answer.
  const there = git(['ls-remote', '--heads', 'origin', branch]).trim();
  if (!there) result = { state: 'absent', reason: null };
  else {
    git(['fetch', '--quiet', 'origin', base, branch]);
    result = resumeState({ git, base, branch, issue, issueHash });
  }
} catch (error) {
  result = { state: 'existing', reason: `git could not read the remote: ${String(error.message).split('\n')[0].slice(0, 160)}` };
}
console.log(JSON.stringify(result));
