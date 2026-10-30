#!/usr/bin/env node
// Says whether every conflicted file is inside openspec/. Usage:
//   node scripts/conflict-scope.mjs               reads `git diff --name-only --diff-filter=U`
//   node scripts/conflict-scope.mjs --paths       reads the paths from stdin, one per line
// exit 0: all inside (or none)   exit 1: prints the files outside   exit 2: bad arguments

import { execFileSync } from 'node:child_process';
import { conflictScope } from './lib/archive-check.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const fromStdin = process.argv.includes('--paths');
const raw = fromStdin ? readFileSync(0, 'utf8') : execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], { encoding: 'utf8' });
const result = conflictScope(raw.split('\n').filter(Boolean));
if (result.ok) {
  console.log(result.paths.length === 0 ? 'no conflicts' : `all ${result.paths.length} conflicted file(s) are under openspec/`);
  process.exit(0);
}
console.log(`conflicts outside openspec/: ${result.outside.join(', ')}`);
process.exit(1);
