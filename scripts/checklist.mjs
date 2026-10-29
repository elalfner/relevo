#!/usr/bin/env node
// Prints the review checklist of a change. Usage:
//   node scripts/checklist.mjs openspec/changes/<id> [--json | --count]
// Default output is a Markdown checklist, one line per scenario of the change's specs.
// --state <file> ticks the lines the person confirmed in an on-device review (see review-state.mjs).

import { existsSync } from 'node:fs';
import { checklistFromChange, checklistMarkdown } from './lib/checklist.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const dir = process.argv[2];
if (!dir || dir.startsWith('--') || !existsSync(dir)) {
  console.error('usage: checklist.mjs <change-directory> [--json | --count]');
  process.exit(2);
}
const items = checklistFromChange(dir);
if (process.argv.includes('--count')) console.log(items.length);
else if (process.argv.includes('--json')) console.log(JSON.stringify(items, null, 2));
else {
  const si = process.argv.indexOf('--state');
  const statuses = {};
  const autos = {};
  if (si !== -1 && existsSync(process.argv[si + 1])) {
    JSON.parse(readFileSync(process.argv[si + 1], 'utf8')).items.forEach((i) => {
      statuses[i.id] = i.status;
      if (i.auto) autos[i.id] = i.auto;
    });
  }
  console.log(checklistMarkdown(items, statuses, autos));
}
