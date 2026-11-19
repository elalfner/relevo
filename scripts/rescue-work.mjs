#!/usr/bin/env node
// Keeps the work of a cloud run that was cut. Usage:
//   node scripts/rescue-work.mjs --decision <base64> [--config relevo.yml] [--github-output <file>]
// It commits what the run left in the working tree as `wip: stopped by limit (#N)`, through the same scans as any commit
// of Relevo, and pushes it to the branch of the issue. It never pushes after a refusal, never force-pushes and never
// overwrites a remote branch: a push is made only when it is a fast-forward of what the remote has. The decision is the
// one the workflow gave the agent.
// Prints one line of JSON { state, branch, files, commit, detail }, plus `checkpoints` when the work was kept and they could be counted; with --github-output it also appends `state=`,
// `branch=` and `detail=` (and `checkpoints=`) to that file, for the step that reports the run.
// It never fails: exit 0 always, so the step that calls it cannot fail a run that was already cut.

import { appendFileSync } from 'node:fs';
import { readDecision } from './lib/rescue-work.mjs';
import { runRescue } from './lib/rescue-run.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

function emit(result) {
  console.log(JSON.stringify(result));
  const out = arg('github-output');
  if (out) {
    // A value goes on one line: the detail may hold several lines of a refusal.
    const flat = (v) => String(v ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 600);
    try {
      // `checkpoints=` only when it was counted: an empty or missing value means unknown, and 0 means none.
      const counted = Number.isInteger(result.checkpoints) ? `checkpoints=${result.checkpoints}\n` : '';
      appendFileSync(out, `state=${result.state}\nbranch=${flat(result.branch)}\ndetail=${flat(result.detail)}\n${counted}`);
    } catch { /* the step that reads it simply finds nothing */ }
  }
}

try {
  const decision = readDecision(arg('decision'));
  if (!decision) emit({ state: 'nothing', branch: null, files: 0, commit: null, detail: 'the decision of the run could not be read' });
  else emit(runRescue({ decision, configPath: arg('config') ?? 'relevo.yml' }));
} catch (error) {
  process.stderr.write(`rescue-work: ${error.message}\n`);
  emit({ state: 'not_pushed', branch: null, files: 0, commit: null, detail: `the rescue failed: ${String(error.message).slice(0, 200)}` });
}
process.exit(0);
