#!/usr/bin/env node
// Reads the sections of an issue body. Usage:
//   node scripts/issue-sections.mjs --body-file issue.md --list                       names of the sections that have text
//   node scripts/issue-sections.mjs --body-file issue.md --section Decisions          the text of one section
//   node scripts/issue-sections.mjs --body-file issue.md --copy "Decisions,Constraints"   the block go appends to design.md
// exit 0: done (a --copy with nothing to copy prints nothing)   exit 1: --section names a section that is not there   exit 2: bad arguments

import { copyBlock, section, sections } from './lib/issue-sections.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const file = arg('body-file');
const modes = ['list', 'section', 'copy'].filter((m) => process.argv.includes(`--${m}`));
if (!file || modes.length !== 1) {
  console.error('usage: issue-sections.mjs --body-file <file> (--list | --section <Name> | --copy "<Name>,<Name>")');
  process.exit(2);
}
let body;
try {
  body = readFileSync(file, 'utf8');
} catch (err) {
  console.error(`cannot read ${file}: ${err.message}`);
  process.exit(2);
}
if (modes[0] === 'list') {
  sections(body).filter((s) => s.text !== '').forEach((s) => console.log(s.name));
} else if (modes[0] === 'section') {
  const s = section(body, arg('section') ?? '');
  if (!s) process.exit(1);
  console.log(s.text);
} else {
  const names = (arg('copy') ?? '').split(',').map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) {
    console.error('--copy needs at least one section name');
    process.exit(2);
  }
  const block = copyBlock(body, names);
  if (block) process.stdout.write(block);
}
