#!/usr/bin/env node
// Says whether a change still has to be archived. Usage:
//   node scripts/archive-state.mjs --change 31-summary [--archive-dir openspec/changes/archive]
// Prints active, archived or missing.   exit 0: active or archived   exit 1: missing   exit 2: bad arguments

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { archiveState } from './lib/archive-state.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const change = arg('change');
if (!change) {
  console.error('usage: archive-state.mjs --change <change folder name> [--archive-dir <dir>]');
  process.exit(2);
}
const dir = arg('archive-dir') ?? 'openspec/changes/archive';
let output;
try {
  output = execFileSync('openspec', ['list', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (error) {
  output = error.stdout; // `openspec list` exits 1 with a JSON body when there is no root: nothing is active
}
const listed = JSON.parse(output || '{}');
const active = (listed.changes ?? []).map((c) => c.name);
const archived = existsSync(dir) ? readdirSync(dir) : [];
const state = archiveState({ active, archived, change });
console.log(state);
process.exit(state === 'missing' ? 1 : 0);
