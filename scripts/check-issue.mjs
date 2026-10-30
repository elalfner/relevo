#!/usr/bin/env node
// Checks a drafted issue. Usage:
//   (--repo-root <folder>, default the current folder, is where the files of a Design reference must exist)
//   node scripts/check-issue.mjs --title "Short plain title" --body-file issue.md [--rules-file CLAUDE.md] [--platforms web,api] [--links acme/api,acme/design]
// --platforms lists the names of the platforms of relevo.yml: with more than one the draft needs a `Platform:` line.
// --rules-file is the project rules file or files, comma separated (`qa.rules_from`), which an `Allow-paths:` line can never list.
// Prints the counts and every problem. exit 0: ready to create   exit 1: problems   exit 2: bad arguments

import { checkIssueDraft } from './lib/issue-check.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

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
const platformNames = (arg('platforms') ?? '').split(',').map((f) => f.trim()).filter(Boolean);
const platforms = platformNames.length ? Object.fromEntries(platformNames.map((n) => [n, {}])) : null;
const links = (arg('links') ?? '').split(',').map((f) => f.trim()).filter(Boolean);
const r = checkIssueDraft({ title, body, platforms, links, repoRoot: arg('repo-root') ?? process.cwd(), rulesFile: (arg('rules-file') ?? '').split(',').map((f) => f.trim()).filter(Boolean) });
const allows = r.allowPaths.length ? `, allows changes to ${r.allowPaths.join(', ')}` : '';
console.log(`${r.scenarios} scenario(s), ${r.edgeCases} edge case(s), depends on ${[...r.dependsOn.map((n) => `#${n}`), ...r.dependsOnExternal.map((d) => `${d.repo}#${d.number}`)].join(', ') || 'nothing'}${allows}`);
r.warnings.forEach((w) => console.error(`warning: ${w}`));
if (r.ok) {
  console.log('ready to create');
  process.exit(0);
}
r.problems.forEach((p) => console.error(`problem: ${p}`));
process.exit(1);
