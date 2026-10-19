#!/usr/bin/env node
// Says whether OpenSpec considers the specification of a change complete. Usage:
//   node scripts/spec-ready.mjs --change <change_id>
//   node scripts/spec-ready.mjs --input status.json        (a saved `openspec status --change <id> --json`)
// Complete means every artifact is done (or skipped, for a change that declares skip_specs).
//   exit 0: complete   exit 1: artifacts missing (named on stdout)   exit 2: bad arguments or OpenSpec failed

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pendingArtifacts, planningComplete } from './lib/openspec-status.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

let status;
try {
  if (arg('input')) status = JSON.parse(readFileSync(arg('input'), 'utf8'));
  else {
    if (!arg('change')) fail('usage: spec-ready.mjs --change <change_id>  (or --input status.json)');
    const r = spawnSync('openspec', ['status', '--change', arg('change'), '--json'], { encoding: 'utf8' });
    if (r.error || r.status !== 0) fail(`openspec status failed${r.stderr ? `: ${r.stderr.trim()}` : ''}`);
    status = JSON.parse(r.stdout);
  }
} catch (err) {
  fail(`could not read the status: ${err.message}`);
}

if (planningComplete(status)) {
  console.log('the specification is complete');
} else {
  const pending = pendingArtifacts(status);
  console.log(pending.length ? `artifacts not done: ${pending.join(', ')}` : 'OpenSpec reported no artifacts');
  process.exit(1);
}
