#!/usr/bin/env node
// Checks that every id of the agreement went into one of the drafts. Usage:
//   node scripts/issue-coverage.mjs --agreement agreement.md --issue 1.md [--issue 2.md ...] [--discarded D3,Q1]
// Prints a table (id, issue, section), the discarded ids and the ids without a destination.
// exit 0: every id has a destination or was discarded   exit 1: some id has none   exit 2: bad arguments

import { readFileSync } from 'node:fs';
import { coverage } from './lib/issue-coverage.mjs';

const values = (name) => process.argv.flatMap((a, i, all) => (a === `--${name}` ? [all[i + 1]] : []));
const [agreementFile] = values('agreement');
const issueFiles = values('issue');
if (!agreementFile || issueFiles.length === 0) {
  console.error('usage: issue-coverage.mjs --agreement <file> --issue <file> [--issue <file> ...] [--discarded D3,Q1]');
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
const discarded = (values('discarded')[0] ?? '').split(',');
const r = coverage({ agreement: read(agreementFile), issues: issueFiles.map((f) => ({ name: f, body: read(f) })), discarded });
r.found.forEach((f) => console.log(`${f.id}\t${f.issue}\t${f.section}`));
r.discarded.forEach((id) => console.log(`${id}\t(discarded)`));
r.missing.forEach((id) => console.log(`${id}\tWITHOUT DESTINATION`));
process.exit(r.ok ? 0 : 1);
