#!/usr/bin/env node
// Scans a unified diff on stdin for temporary markers and credentials.
// Usage: git diff --cached | node scripts/scan-diff.mjs
//   exit 0: clean   exit 1: findings or a restricted file (nothing should be committed or pushed)

import { formatFindings, scanDiff } from './lib/scan.mjs';
import { formatRestricted, restrictedInDiff } from './lib/restricted-paths.mjs';
import { projectList, readFileSync } from './lib/guarded-fs.mjs';

const diff = readFileSync(0, 'utf8');
// A restricted file in the diff is reported by its name and its lines are never scanned, so nothing of them is printed.
const restricted = restrictedInDiff(diff, projectList());
if (restricted.length > 0) {
  console.error(formatRestricted(restricted));
  console.error(`\n${restricted.length} restricted file(s) in the diff: do not commit or push until they are removed`);
  process.exit(1);
}
const findings = scanDiff(diff);
if (findings.length === 0) {
  console.log('no temporary markers or credentials found');
  process.exit(0);
}
console.error(formatFindings(findings));
console.error(`\n${findings.length} finding(s): do not commit or push until they are removed`);
process.exit(1);
