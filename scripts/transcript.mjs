#!/usr/bin/env node
// Prints a redacted rendering of the agent's execution log. Usage:
//   node scripts/transcript.mjs --file <execution_file> [--results] [--summary]
// The secrets of the job come from the environment variable RELEVO_REDACT (one value per line), never from the arguments.
// --results adds the first characters of each result (only when the full output is on). --summary prints the number of entries instead.
// It never fails: exit 0 always, so a step that prints or saves it cannot fail a run. Nothing found prints nothing.

import { transcript, renderTranscript } from './lib/transcript.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

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
const secrets = String(process.env.RELEVO_REDACT ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
const options = { results: process.argv.includes('--results'), secrets };

try {
  if (process.argv.includes('--summary')) {
    const t = transcript(text, options);
    if (t.kept > 0) console.log(`${t.kept} of ${t.total}`);
  } else {
    process.stdout.write(renderTranscript(text, options));
  }
} catch {
  // a log that cannot be read says nothing
}
process.exit(0);
