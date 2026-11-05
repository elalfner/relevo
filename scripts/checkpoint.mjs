#!/usr/bin/env node
// A checkpoint of a build: after the developer finishes group `k` of `n` of the tasks, the files that changed are
// committed as `wip: checkpoint k/n (#N)` and the branch of the issue is pushed, so that a cut or a limit loses at most
// the group in progress. Usage:
//   node scripts/checkpoint.mjs --decision <base64> --k <n> --of <n> [--config relevo.yml]
// The commit goes through the same safe commit as every commit of Relevo (protected paths, restricted files, temporary
// markers, credentials) and carries the hash of the issue text as a trailer, which a later run compares before it resumes.
// The push is a fast-forward only; nothing is forced.
// Prints one line of JSON { state, branch, files, commit, detail }.
//   exit 0: kept, or nothing to keep, or not pushed (the build goes on; the final push will say if it cannot)
//   exit 1: a commit was refused (`unsafe`): the detail names the file and why, and the build takes the failure path
//   exit 2: bad arguments

import { checkpointSubject } from './lib/wip-commit.mjs';
import { readDecision } from './lib/rescue-work.mjs';
import { runRescue } from './lib/rescue-run.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const whole = (v) => (/^\d{1,4}$/.test(String(v ?? '')) && Number(v) > 0 ? Number(v) : null);

const decision = readDecision(arg('decision'));
const k = whole(arg('k'));
const n = whole(arg('of'));
if (!decision || k === null || n === null || k > n) {
  console.error('usage: checkpoint.mjs --decision <base64> --k <n> --of <n>   (1 <= k <= of)');
  process.exit(2);
}
let result;
try {
  result = runRescue({ decision, configPath: arg('config') ?? 'relevo.yml', subject: checkpointSubject(decision.issue, k, n) });
} catch (error) {
  result = { state: 'not_pushed', branch: decision.branch, files: 0, commit: null, detail: `the checkpoint failed: ${String(error.message).slice(0, 200)}` };
}
console.log(JSON.stringify(result));
process.exit(result.state === 'unsafe' ? 1 : 0);
