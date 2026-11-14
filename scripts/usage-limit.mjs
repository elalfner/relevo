#!/usr/bin/env node
// Did a cloud run end because a usage limit, a quota or the credit was reached? Usage:
//   node scripts/usage-limit.mjs --file <execution_file>
//   exit 0: the log shows it; when it also gives a credible reset time, that time is printed (ISO, UTC)
//   exit 1: it does not, or the file is missing or unreadable
// The final step of the build job uses it to say "label the issue ready again later" instead of the generic text.

import { limitReset, reachedUsageLimit } from './lib/run-usage.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const i = process.argv.indexOf('--file');
let text = '';
try {
  if (i !== -1) text = readFileSync(process.argv[i + 1], 'utf8');
} catch {
  text = '';
}
if (!reachedUsageLimit(text)) process.exit(1);
const reset = limitReset(text);
if (reset !== null) console.log(new Date(reset).toISOString());
process.exit(0);
