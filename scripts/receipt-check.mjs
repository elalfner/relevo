#!/usr/bin/env node
// Says whether the receipt of the gate is valid for the diff as it is now. Usage:
//   node scripts/receipt-check.mjs [--root dir]
// `go`, `fix` and `review` run it before every lens: a lens starts only on exit 0. It recomputes the hash of the diff against
// the base the receipt recorded, leaving out the same generated files, and compares it with the receipt's.
//   exit 0: valid and green   exit 1: the diff changed, or the receipt is red or missing (run the gate again)   exit 3: bad arguments

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RECEIPT_DIR, RECEIPT_FILE, checkReceipt, diffHash, excludeSpecs } from './lib/validation-gate.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const i = process.argv.indexOf('--root');
const root = resolve(i === -1 ? '.' : process.argv[i + 1] ?? '.');
const file = join(root, RECEIPT_DIR, RECEIPT_FILE);
if (!existsSync(file)) { console.error('there is no receipt: run the gate first'); process.exit(1); }
let receipt;
try { receipt = JSON.parse(readFileSync(file, 'utf8')); } catch { console.error('the receipt is not valid JSON: run the gate again'); process.exit(1); }
try {
  const diff = execFileSync('git', ['diff', receipt.base_ref, '--', '.', ...excludeSpecs(receipt.generated ?? [])], { encoding: 'utf8', cwd: root, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const result = checkReceipt(receipt, diffHash(diff));
  console.log(result.reason);
  process.exit(result.ok ? 0 : 1);
} catch (err) {
  console.error(`could not compute the diff: ${String(err.stderr || err.message).trim()}`);
  process.exit(3);
}
