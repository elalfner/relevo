#!/usr/bin/env node
// Checks that the schema of a change is one Relevo understands, before the developer agent starts and before any model is spent.
// Usage: node scripts/schema-guard.mjs --change <change id>
// It runs the one OpenSpec command that `go` already uses for this, `openspec instructions apply --change <id> --json`, reads
// `schemaName` and `taskTrackingConfigured` from its output and prints one line of JSON:
//   { "ok": true, "schema": "spec-driven" }
//   { "ok": false, "schema": "<name>", "reason": "unsupported schema: <name>", "detail": "..." }
//   exit 0: supported       exit 1: not supported (take the failure path with `reason` and the recovery `schema`)
//   exit 2: bad arguments, or OpenSpec did not answer (the step that checks the environment already stops a run without OpenSpec)

import { spawnSync } from 'node:child_process';
import { checkApplySchema } from './lib/schema-guard.mjs';

const i = process.argv.indexOf('--change');
const change = i === -1 ? '' : String(process.argv[i + 1] ?? '');
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(change)) {
  console.error('usage: schema-guard.mjs --change <change id>');
  process.exit(2);
}

const run = spawnSync('openspec', ['instructions', 'apply', '--change', change, '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
let instructions;
try {
  if (run.status !== 0) throw new Error(String(run.stderr ?? '').slice(0, 200) || `exit ${run.status}`);
  instructions = JSON.parse(run.stdout);
} catch (error) {
  console.error(`schema-guard: OpenSpec did not give the apply instructions of "${change}": ${error.message}`);
  process.exit(2);
}
const verdict = checkApplySchema(instructions);
console.log(JSON.stringify(verdict));
process.exit(verdict.ok ? 0 : 1);
