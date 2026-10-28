#!/usr/bin/env node
// Prints what a cloud run used, read from the execution log of the agent runner: one sentence, a blank line and a hidden
// marker with the same figures, which the daily digest adds up. Usage:
//   node scripts/run-usage.mjs --file <execution_file> [--subscription]
// --subscription says that the cost is notional. Prints nothing when the log is missing or has no usage.
// It never fails: exit 0 always, so a step that posts the text cannot fail a run.

import { readFileSync } from 'node:fs';
import { readUsage, usageLine, usageMarker } from './lib/run-usage.mjs';

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
const line = usageLine(usage, { subscription });
const marker = usageMarker(usage, { subscription });
if (line) console.log(marker ? `${line}\n\n${marker}` : line);
