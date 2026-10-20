#!/usr/bin/env node
// Did a cloud run end because a usage limit, a quota or the credit was reached? Usage:
//   node scripts/usage-limit.mjs --file <execution_file>
//   exit 0: the log shows it   exit 1: it does not, or the file is missing or unreadable
// The final step of the build job uses it to say "label the issue ready again later" instead of the generic text.

import { readFileSync } from 'node:fs';
import { reachedUsageLimit } from './lib/run-usage.mjs';

const i = process.argv.indexOf('--file');
let text = '';
try {
  if (i !== -1) text = readFileSync(process.argv[i + 1], 'utf8');
} catch {
  text = '';
}
process.exit(reachedUsageLimit(text) ? 0 : 1);
