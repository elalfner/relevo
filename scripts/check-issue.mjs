#!/usr/bin/env node
// Checks a drafted issue. Usage:
//   node scripts/check-issue.mjs --title "Short plain title" --body-file issue.md [--rules-file CLAUDE.md]
// --rules-file is the project rules file or files, comma separated (`qa.rules_from`), which an `Allow-paths:` line can never list.
// Prints the counts and every problem. exit 0: ready to create   exit 1: problems   exit 2: bad arguments

import { readFileSync } from 'node:fs';
import { checkIssueDraft } from './lib/issue-check.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const title = arg('title');
const file = arg('body-file');
if (title === undefined || !file) {
  console.error('usage: check-issue.mjs --title "<title>" --body-file <file>');
  process.exit(2);
}
let body;
try {
  body = readFileSync(file, 'utf8');
} catch (err) {
  console.error(`cannot read ${file}: ${err.message}`);
  process.exit(2);
}
const r = checkIssueDraft({ title, body, rulesFile: (arg('rules-file') ?? '').split(',').map((f) => f.trim()).filter(Boolean) });
const allows = r.allowPaths.length ? `, allows changes to ${r.allowPaths.join(', ')}` : '';
console.log(`${r.scenarios} scenario(s), ${r.edgeCases} edge case(s), depends on ${r.dependsOn.length ? r.dependsOn.map((n) => `#${n}`).join(', ') : 'nothing'}${allows}`);
if (r.ok) {
  console.log('ready to create');
  process.exit(0);
}
r.problems.forEach((p) => console.error(`problem: ${p}`));
process.exit(1);
