#!/usr/bin/env node
// Makes new files show up in `git diff <base>` without staging their content. Usage:
//   node scripts/intent-to-add.mjs path [path ...]
// `go` runs it on the files the developer reported, before QA reviews the work. Files that git ignores and files that
// do not exist are skipped. Refuses "." and "-A": name the files.
//   exit 0: done (prints what was marked and skipped)   exit 2: bad arguments or git failed

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { intentToAdd } from './lib/intent-to-add.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  const { marked, ignored, missing } = intentToAdd({ git, exists: existsSync, paths: process.argv.slice(2) });
  console.log(`marked ${marked.length} file(s) for the diff${ignored.length ? `, skipped ${ignored.length} ignored by git` : ''}${missing.length ? `, skipped ${missing.length} that do not exist` : ''}`);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
