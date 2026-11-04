#!/usr/bin/env node
// Prints what a cloud run used, read from the execution log of the agent runner: one sentence, a blank line and a hidden
// marker with the same figures, which the daily digest adds up. Usage:
//   node scripts/run-usage.mjs --file <execution_file> [--subscription] [--progress-dir <dir>] [--config <relevo.yml>]
// --config gives the limits of the run: the sentence says when the turns (the subagents' included) or the cost went past them.
// --progress-dir is where `go` kept the start of each phase and the class of the outcome: they go into the marker.
// --subscription says that the cost is notional. Prints nothing when the log is missing or has no usage.
// It never fails: exit 0 always, so a step that posts the text cannot fail a run.

import { readUsage, usageLine, usageMarker } from './lib/run-usage.mjs';
import { phaseSeconds, readClass, readPhaseLog } from './lib/phase-log.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { loadConfig } from './lib/config.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

let text = '';
try {
  if (arg('file')) text = readFileSync(arg('file'), 'utf8');
} catch {
  text = '';
}
const usage = readUsage(text);
const subscription = process.argv.includes('--subscription');
let limits = null;
try {
  if (arg('config')) limits = loadConfig(readFileSync(arg('config'), 'utf8')).config?.limits ?? null;
} catch {
  limits = null;
}
const line = usageLine(usage, { subscription, limits });
const dir = arg('progress-dir');
let phases = null;
let outcomeClass = null;
try {
  if (dir) {
    const log = readPhaseLog(dir);
    phases = log.length ? phaseSeconds(log, Date.now()) : null;
    // A run that wrote no class ended some other way than the ones `go` names, even one that never announced a phase.
    outcomeClass = readClass(dir) ?? 'other';
  }
} catch {
  phases = null;
}
const marker = usageMarker(usage, { subscription, phases, outcomeClass });
if (line) console.log(marker ? `${line}\n\n${marker}` : line);
