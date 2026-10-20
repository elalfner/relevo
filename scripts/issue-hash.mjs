#!/usr/bin/env node
// Checks that an issue still has the text it was claimed with. Usage:
//   node scripts/issue-hash.mjs --repo owner/name --issue 42 --expect <hash>   exit 0 same, 1 different
//   node scripts/issue-hash.mjs --input issue.json --expect <hash>             (a saved `gh issue view --json title,body`)
//   node scripts/issue-hash.mjs --repo owner/name --issue 42                   prints the hash
// exit 2: bad arguments or the issue could not be read.

import { readFileSync } from 'node:fs';
import { realGh } from './lib/github.mjs';
import { checkIssueHash, issueHash, shortHash } from './lib/issue-hash.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

let issue;
try {
  if (arg('input')) {
    issue = JSON.parse(readFileSync(arg('input'), 'utf8'));
  } else {
    const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
    const number = arg('issue');
    if (!repo || !/^\d+$/.test(number ?? '')) fail('usage: issue-hash.mjs --repo owner/name --issue <number> [--expect <hash>]  (or --input issue.json)');
    issue = JSON.parse(realGh(['issue', 'view', number, '--repo', repo, '--json', 'title,body']));
  }
} catch (err) {
  fail(`could not read the issue: ${err.message}`);
}

if (!arg('expect')) {
  console.log(issueHash(issue));
} else {
  const { ok, actual } = checkIssueHash({ expected: arg('expect'), ...issue });
  if (ok) console.log(`the issue text is unchanged (${shortHash(actual)})`);
  else {
    console.log(`the issue text changed after it was claimed (expected ${shortHash(arg('expect'))}, found ${shortHash(actual)})`);
    process.exit(1);
  }
}
