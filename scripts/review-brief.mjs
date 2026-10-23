#!/usr/bin/env node
// Prints a short brief of an issue for the person who reviews it. Usage:
//   node scripts/review-brief.mjs --issue 42 --title "Birthday list" --body-file issue.md [--built-file comment.md] [--language en|es]
//        [--autopilot off|precheck|verify]
// exit 0: printed   exit 2: bad arguments

import { readFileSync } from 'node:fs';
import { reviewBrief } from './lib/review-brief.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const number = arg('issue');
const title = arg('title');
const bodyFile = arg('body-file');
if (!number || title === undefined || !bodyFile) {
  console.error('usage: review-brief.mjs --issue <n> --title "<title>" --body-file <file> [--built-file <file>] [--language en|es] [--autopilot off|precheck|verify]');
  process.exit(2);
}
const read = (f) => {
  try {
    return readFileSync(f, 'utf8');
  } catch (err) {
    console.error(`cannot read ${f}: ${err.message}`);
    process.exit(2);
  }
};
const built = arg('built-file') ? read(arg('built-file')) : '';
console.log(reviewBrief({ issue: { number, title, body: read(bodyFile) }, built, language: arg('language') ?? 'en', autopilot: arg('autopilot') ?? 'off' }));
