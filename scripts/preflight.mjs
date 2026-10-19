#!/usr/bin/env node
// The checks to make before building or fixing anything. Usage:
//   node scripts/preflight.mjs [--checks config,openspec,openspec-root,clean-tree,gh] [--config relevo.yml]
// Default checks: config, openspec, openspec-root, clean-tree. `gh` (signed in to GitHub) is asked for by the
// commands that need it. Prints one block per failure with its fix.
//   exit 0: all passed   exit 1: something failed   exit 2: unknown check

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DEFAULT_CHECKS, formatPreflight, runPreflight } from './lib/preflight.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const checks = arg('checks') ? arg('checks').split(',').map((c) => c.trim()).filter(Boolean) : DEFAULT_CHECKS;
const run = (command, args) => {
  const r = spawnSync(command, args, { encoding: 'utf8' });
  return { status: r.error ? 127 : r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

try {
  const result = runPreflight({ checks, readConfig: () => readFileSync(resolve(arg('config') ?? 'relevo.yml'), 'utf8'), run });
  const text = formatPreflight(result);
  if (result.ok) console.log(text);
  else console.error(text);
  process.exit(result.ok ? 0 : 1);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
