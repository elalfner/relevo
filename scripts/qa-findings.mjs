#!/usr/bin/env node
// Says what the classes of the findings of a QA report mean for the retries. Usage:
//   node scripts/qa-findings.mjs --file qa-report.md       (or the report on stdin)
// Prints JSON: { verdict, total, fixable, non_fixable, all_non_fixable, first_non_fixable_class, findings }.
// `all_non_fixable` is true when the report rejects and no finding is `fixable`: `go` then skips the retries.
// A finding with no class, or with an unknown one, counts as `fixable`.
//   exit 0: printed   exit 2: bad arguments or the report cannot be read
import { summarize } from './lib/qa-findings.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const argv = process.argv.slice(2);
const fileAt = argv.indexOf('--file');
if (argv.some((a) => a.startsWith('--') && a !== '--file') || (fileAt !== -1 && !argv[fileAt + 1])) {
  console.error('usage: qa-findings.mjs [--file qa-report.md]  (the report on stdin when there is no --file)');
  process.exit(2);
}
let report;
try {
  report = readFileSync(fileAt === -1 ? 0 : argv[fileAt + 1], 'utf8');
} catch (err) {
  console.error(`cannot read the report: ${err.message}`);
  process.exit(2);
}
console.log(JSON.stringify(summarize(report)));
