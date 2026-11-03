#!/usr/bin/env node
// Prints the checklist lines for the advisory notes that QA left in a `built` comment. Usage:
//   node scripts/qa-notes.mjs --built-file comment.md [--language en|es]
// The notes travel in the hidden marker `relevo:qa-notes` of the comment; each becomes a line "- [ ] <note> (pending after the
// retries, <lens> lens)". Prints nothing when there are none, or when the marker is broken.
//   exit 0: printed   exit 2: bad arguments

import { qaNotesChecklist } from './lib/review-brief.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? undefined : process.argv[i + 1]; };
const file = arg('built-file');
if (!file) { console.error('usage: qa-notes.mjs --built-file <comment> [--language en|es]'); process.exit(2); }
let text;
try { text = readFileSync(file, 'utf8'); } catch (err) { console.error(`cannot read ${file}: ${err.message}`); process.exit(2); }
const lines = qaNotesChecklist(text, arg('language') === 'es' ? 'es' : 'en');
if (lines.length) console.log(lines.join('\n'));
