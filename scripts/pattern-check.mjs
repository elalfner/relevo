#!/usr/bin/env node
// The template of a replicated build: the merged change of the issue named by `Pattern: #N`. Usage:
//   node scripts/pattern-check.mjs --issue-file issue.md --repo <owner/name> --base <branch> [--issue <number>] [--out <dir>]
// Prints JSON { pattern, state, detail, files, diff_file, truncated, problems }. `state` is `none` (no Pattern: line), `merged`,
// `not-merged`, `missing` or `unknown` (see scripts/lib/pattern.mjs). The diff is written to <dir>/pattern-<N>.diff (default
// $RELEVO_PROGRESS_DIR, else the system temporary folder), never inside the working tree, so it cannot be committed.
//   exit 0: no pattern, or merged, or unknown (the lookup failed: the build goes on and lists it as unverified)
//   exit 1: the pattern is not merged, does not exist, or the line is wrong   exit 2: bad arguments

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseIssueBody } from './lib/issue-parse.mjs';
import { findPatternChange } from './lib/pattern.mjs';
import { realGh } from './lib/github.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
if (!arg('issue-file') || !arg('repo') || !arg('base')) {
  console.error('usage: pattern-check.mjs --issue-file <file> --repo <owner/name> --base <branch> [--issue <n>] [--out <dir>]');
  process.exit(2);
}

const parsed = parseIssueBody(readFileSync(arg('issue-file'), 'utf8'));
const problems = [...parsed.patternProblems];
if (parsed.pattern !== null && String(parsed.pattern) === String(arg('issue') ?? '')) problems.push('the pattern is the issue itself');
if (problems.length > 0) {
  console.log(JSON.stringify({ pattern: null, state: 'invalid', detail: problems.join('; '), files: [], problems }));
  process.exit(1);
}
if (parsed.pattern === null) {
  console.log(JSON.stringify({ pattern: null, state: 'none', detail: 'the issue declares no pattern', files: [], problems }));
  process.exit(0);
}

const result = findPatternChange({ repo: arg('repo'), number: parsed.pattern, base: arg('base'), gh: realGh });
let diffFile = null;
if (result.state === 'merged') {
  const dir = arg('out') ?? process.env.RELEVO_PROGRESS_DIR ?? join(tmpdir(), 'relevo-pattern');
  mkdirSync(dir, { recursive: true });
  diffFile = join(dir, `pattern-${parsed.pattern}.diff`);
  writeFileSync(diffFile, result.diff);
}
const { diff, ...rest } = result;
console.log(JSON.stringify({ pattern: parsed.pattern, ...rest, diff_file: diffFile, problems }));
process.exit(['merged', 'unknown'].includes(result.state) ? 0 : 1);
