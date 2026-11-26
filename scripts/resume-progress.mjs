#!/usr/bin/env node
// Did a resumed run make progress? Implements "A resume that finishes no task stops the loop" of the go specification. Usage:
//   node scripts/resume-progress.mjs start --done <n>
//       records how many tasks of tasks.md are done when a resumed run starts (the run calls it once, in step 4)
//   node scripts/resume-progress.mjs check --reason <reason> --done <n> [--config relevo.yml]
//       at the failure path: prints one line of JSON, `{ "stalled": false }`, or `{ "stalled": true, "limit_turns", "limit_minutes", "limit_cost" }`
//       when the run was resumed, stopped at a limit (`run limit reached`) and finished no task. The three numbers are the limits in force
//       and go to the `build_failed` message, which writes the marker that the planner reads.
// The record is kept under $RELEVO_PROGRESS_DIR, outside the working tree. Without a state folder, without a record of a start, or without
// limits it can read, the answer is "not stalled": a figure that is not known is never taken for a stall. It never fails a run.

import { existsSync, mkdirSync, readFileSync as readPlain, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { madeNoProgress } from './lib/stalled-marker.mjs';
import { progressDir } from './lib/worktree-path.mjs';

const [command, ...args] = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const whole = (raw) => (/^\d{1,6}$/.test(String(raw ?? '')) ? Number(raw) : null);
const dir = progressDir();
const FILE = 'resume-start.json';

try {
  if (command === 'start') {
    const done = whole(arg('done'));
    if (dir && done !== null) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, FILE), JSON.stringify({ done }));
    }
  } else if (command === 'check') {
    let answer = { stalled: false };
    const start = dir && existsSync(join(dir, FILE)) ? whole(JSON.parse(readPlain(join(dir, FILE), 'utf8')).done) : null;
    const path = resolve(arg('config') ?? 'relevo.yml');
    const loaded = existsSync(path) ? loadConfig(readFileSync(path, 'utf8')) : null;
    const limits = loaded?.ok ? loaded.config.limits : null;
    if (limits && madeNoProgress({ resumed: start !== null, reason: arg('reason'), doneAtStart: start, doneAtEnd: whole(arg('done')) })
      && [limits.run_max_turns, limits.run_max_minutes, limits.run_max_cost].every((n) => typeof n === 'number' && n > 0)) {
      answer = { stalled: true, limit_turns: limits.run_max_turns, limit_minutes: limits.run_max_minutes, limit_cost: limits.run_max_cost };
    }
    console.log(JSON.stringify(answer));
  } else {
    process.stderr.write('resume-progress: use `start` or `check`\n');
    process.exit(2);
  }
} catch (error) {
  process.stderr.write(`resume-progress: ${error.message}\n`);
  if (command === 'check') console.log(JSON.stringify({ stalled: false }));
}
