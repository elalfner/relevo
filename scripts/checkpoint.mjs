#!/usr/bin/env node
// A checkpoint of a build: after the developer finishes group `k` of `n` of the tasks, the files that changed are
// committed as `wip: checkpoint k/n (#N)` and the branch of the issue is pushed, so that a cut or a limit loses at most
// the group in progress. Usage:
//   node scripts/checkpoint.mjs --decision <base64> --k <n> --of <n> [--tasks 1.1,1.2] [--config relevo.yml]
// The commit goes through the same safe commit as every commit of Relevo (protected paths, restricted files, temporary
// markers, credentials) and carries the hash of the issue text as a trailer, which a later run compares before it resumes, and
// the numbers of the tasks of the group (`Relevo-Tasks:`): a resumed run numbers its groups again, so a checkpoint is found by
// the tasks it covers (`replica-plan.mjs template --section K`) and not by `k/n`.
// The push is a fast-forward only; nothing is forced.
// Prints one line of JSON { state, branch, files, commit, detail, unmarked }. `unmarked` lists the tasks of `--tasks` that are still
// unchecked in the tasks.md of the change (empty when all are marked); it is absent when the tasks given are not task numbers or
// the file cannot be read. `go` reads it after each group.
//   exit 0: kept, or nothing to keep, or not pushed (the build goes on; the final push will say if it cannot)
//   exit 1: a commit was refused (`unsafe`): the detail names the file and why, and the build takes the failure path
//   exit 2: bad arguments

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkpointSubject, cleanTaskIds } from './lib/wip-commit.mjs';
import { uncheckedTasks } from './lib/tasks-file.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { readDecision } from './lib/rescue-work.mjs';
import { runRescue } from './lib/rescue-run.mjs';
import { recordCheckpointed } from './lib/group-progress.mjs';
import { progressDir } from './lib/worktree-path.mjs';

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
const tasks = cleanTaskIds(arg('tasks'));
let result;
try {
  result = runRescue({ decision, configPath: arg('config') ?? 'relevo.yml', subject: checkpointSubject(decision.issue, k, n), tasks });
} catch (error) {
  result = { state: 'not_pushed', branch: decision.branch, files: 0, commit: null, detail: `the checkpoint failed: ${String(error.message).slice(0, 200)}` };
}
// The progress shows the group in progress: the one after this. Best effort, and the output does not change.
if (result.state !== 'unsafe') recordCheckpointed(progressDir(), k, n);
// The boxes are read after the commit, from the working tree: a task the developer did not mark is found at its group.
try {
  const file = join('openspec', 'changes', decision.change ?? '', 'tasks.md');
  if (tasks.length > 0 && decision.change && existsSync(file)) {
    const open = uncheckedTasks(readFileSync(file, 'utf8'));
    result = { ...result, unmarked: tasks.filter((id) => open.includes(id)) };
  }
} catch {
  // the list is an addition: its absence changes nothing
}
console.log(JSON.stringify(result));
process.exit(result.state === 'unsafe' ? 1 : 0);
