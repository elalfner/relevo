#!/usr/bin/env node
// Scans a unified diff on stdin for temporary markers and credentials.
// Usage: git diff --cached | node scripts/scan-diff.mjs
//   exit 0: clean   exit 1: findings (nothing should be committed or pushed)

import { readFileSync } from 'node:fs';
import { formatFindings, scanDiff } from './lib/scan.mjs';

const findings = scanDiff(readFileSync(0, 'utf8'));
if (findings.length === 0) {
  console.log('no temporary markers or credentials found');
  process.exit(0);
}
console.error(formatFindings(findings));
console.error(`\n${findings.length} finding(s): do not commit or push until they are removed`);
process.exit(1);
