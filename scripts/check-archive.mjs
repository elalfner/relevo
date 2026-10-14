#!/usr/bin/env node
// After `openspec archive`, checks that the archive changed nothing outside openspec/.
//   node scripts/check-archive.mjs [--dir openspec]
//   exit 0: only the specifications folder changed   exit 1: something else changed, or nothing changed

import { execFileSync } from 'node:child_process';
import { checkArchiveChanges, pathsFromPorcelain } from './lib/archive-check.mjs';

const di = process.argv.indexOf('--dir');
const dir = di === -1 ? 'openspec' : process.argv[di + 1];
const paths = pathsFromPorcelain(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }));
const result = checkArchiveChanges(paths, dir);
if (result.ok) {
  console.log(`the archive changed ${paths.length} path(s), all under ${dir}/`);
  process.exit(0);
}
if (result.empty) console.log('the archive changed nothing: was the change already archived?');
else console.log(`the archive changed files outside ${dir}/: ${result.outside.join(', ')}`);
process.exit(1);
