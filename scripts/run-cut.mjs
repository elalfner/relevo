#!/usr/bin/env node
// Which limit of the runner cut a cloud run? Usage:
//   node scripts/run-cut.mjs --file <execution_file>
// Prints `turns` (the runner's --max-turns) or `cost` (its --max-budget-usd) when the result in the log says so, and
// nothing otherwise. The report step of the go workflow uses it to say which limit it was.
// It never fails: exit 0 always, so that a step that calls it inside `$(...)` cannot stop under `bash -e`.

import { runnerCut } from './lib/run-usage.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const i = process.argv.indexOf('--file');
let text = '';
try {
  if (i !== -1) text = readFileSync(process.argv[i + 1], 'utf8');
} catch {
  text = '';
}
const cut = runnerCut(text);
if (cut) console.log(cut);
