#!/usr/bin/env node
// Prints one line with what a cloud run used, read from the execution log of the agent runner. Usage:
//   node scripts/run-usage.mjs --file <execution_file> [--subscription]
// --subscription says that the cost is notional. Prints nothing when the log is missing or has no usage.
// It never fails: exit 0 always, so a step that posts the line cannot fail a run.

import { readFileSync } from 'node:fs';
import { readUsage, usageLine } from './lib/run-usage.mjs';

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
const line = usageLine(readUsage(text), { subscription: process.argv.includes('--subscription') });
if (line) console.log(line);
