#!/usr/bin/env node
// Says whether the working tree may switch branches: a dev server of the address under review that runs from it
// would lose its files. Usage:
//   node scripts/dev-server-guard.mjs --url http://localhost:5173
// Prints { code, servers, reason } as JSON.
//   exit 0: no server of that address runs from the working tree   exit 1: one does (stop it before switching)
//   exit 3: it cannot tell (no lsof, or the folder cannot be read): do not switch   exit 2: bad arguments

import { realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { guard } from './lib/dev-server-guard.mjs';

const i = process.argv.indexOf('--url');
const url = i === -1 ? undefined : process.argv[i + 1];
try {
  if (!url || !/^https?:$/.test(new URL(url).protocol)) throw new Error();
} catch {
  console.error('usage: dev-server-guard.mjs --url <http address>');
  process.exit(2);
}
const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
if (top.status !== 0) {
  console.error('not inside a git repository');
  process.exit(2);
}
const lsof = (args) => {
  const r = spawnSync('lsof', args, { encoding: 'utf8' });
  return { status: r.error ? 127 : r.status ?? 1, stdout: r.stdout ?? '' };
};
const result = guard({ url, repoRoot: top.stdout.trim() }, { lsof, realpath: realpathSync });
console.log(JSON.stringify(result));
process.exit(result.code);
