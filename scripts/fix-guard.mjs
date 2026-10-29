#!/usr/bin/env node
// Checks that the specification was updated before any code was written for a fix. Usage:
//   node scripts/fix-guard.mjs openspec/changes/<id>
//   exit 0: the developer may run   exit 1: the specification is not ready (reasons printed)

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { checkSpecFirst } from './lib/fix-guard.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const changeDir = (process.argv[2] ?? '').replace(/\/+$/, '');
if (!changeDir || !existsSync(changeDir)) {
  console.error('usage: fix-guard.mjs <change-directory>');
  process.exit(2);
}
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const lines = (text) => text.split('\n').filter(Boolean);

const changedFiles = [...new Set([...lines(git('diff', '--name-only', 'HEAD')), ...lines(git('ls-files', '--others', '--exclude-standard'))])];

// Lines added to tracked files (diff against HEAD) plus every line of new, untracked files.
const trackedAdded = (path) => lines(git('diff', '-U0', 'HEAD', '--', path)).filter((l) => l.startsWith('+') && !l.startsWith('+++'));
const untrackedAdded = (prefix) => changedFiles
  .filter((f) => (f === prefix || f.startsWith(prefix)) && git('ls-files', '--', f).trim() === '')
  .flatMap((f) => lines(readFileSync(f, 'utf8')).map((l) => `+${l}`));
const added = (path, prefix) => [...trackedAdded(path), ...untrackedAdded(prefix)];

const { ok, reasons } = checkSpecFirst({
  changedFiles,
  changeDir,
  specLinesAdded: added(`${changeDir}/specs`, `${changeDir}/specs/`),
  taskLinesAdded: added(`${changeDir}/tasks.md`, `${changeDir}/tasks.md`),
});
if (ok) console.log('the specification is ready: the developer may run');
else {
  console.log('the specification is NOT ready; the developer must not run yet:');
  reasons.forEach((r) => console.log(`  - ${r}`));
}
process.exit(ok ? 0 : 1);
