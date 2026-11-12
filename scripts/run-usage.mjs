#!/usr/bin/env node
// Prints what a cloud run used, read from the execution log of the agent runner: one sentence, a blank line and a hidden
// marker with the same figures, which the daily digest adds up. Usage:
//   node scripts/run-usage.mjs --file <execution_file> [--subscription] [--progress-dir <dir>] [--config <relevo.yml>] [--receipt <file>] [--language <xx>]
// The sentence is written in --language, else in the `language` of --config (English when neither is given).
// --receipt is the receipt of the validation gate (default .relevo-receipt/receipt.json): the seconds of each check go into the sentence and the marker.
// --config gives the limits of the run: the sentence says when the turns (the subagents' included) or the cost went past them.
// --progress-dir is where `go` kept the start of each phase and of each QA lens, the class of the outcome and the model plan: they go into the marker.
// With a model plan the sentence also says which model each role used and why.
// --subscription says that the cost is notional. Prints nothing when the log is missing or has no usage.
// It never fails: exit 0 always, so a step that posts the text cannot fail a run.

import { checksFromReceipt, planFromJson, readUsage, usageLine, usageMarker } from './lib/run-usage.mjs';
import { lensSeconds, phaseSeconds, readClass, readLensLog, readPhaseLog } from './lib/phase-log.mjs';
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
// The language of the sentence: --language, else the `language` of the config, else English.
let language = arg('language') ?? null;
try {
  if (arg('config')) {
    const config = loadConfig(readFileSync(arg('config'), 'utf8')).config;
    limits = config?.limits ?? null;
    language ??= config?.language ?? null;
  }
} catch {
  limits = null;
}
const dir = arg('progress-dir');
// The model plan `go` made and saved, when there is one: a run without it gives the comment it always gave.
let plan = null;
try {
  if (dir) plan = planFromJson(readFileSync(`${dir}/model-plan.json`, 'utf8'));
} catch {
  plan = null;
}
// The receipt the gate wrote in this working folder, when there is one: its checks and seconds. It is read as data.
let checks = null;
try {
  checks = checksFromReceipt(readFileSync(arg('receipt') ?? '.relevo-receipt/receipt.json', 'utf8'));
} catch {
  checks = null;
}
const line = usageLine(usage, { subscription, limits, plan, checks, language: language ?? 'en' });
let phases = null;
let lenses = null;
let outcomeClass = null;
try {
  if (dir) {
    const log = readPhaseLog(dir);
    phases = log.length ? phaseSeconds(log, Date.now()) : null;
    const lensLog = readLensLog(dir);
    lenses = lensLog.length ? lensSeconds(lensLog, log, Date.now()) : null;
    // A run that wrote no class ended some other way than the ones `go` names, even one that never announced a phase.
    outcomeClass = readClass(dir) ?? 'other';
  }
} catch {
  phases = null;
  lenses = null;
}
const marker = usageMarker(usage, { subscription, phases, lenses, outcomeClass, plan, checks });
if (line) console.log(marker ? `${line}\n\n${marker}` : line);
