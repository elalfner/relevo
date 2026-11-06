#!/usr/bin/env node
// The checks to make before building or fixing anything. Usage:
//   node scripts/preflight.mjs [--checks config,openspec,openspec-root,clean-tree,gh] [--config relevo.yml]
// Default checks: config, openspec, openspec-root, clean-tree. `gh` (signed in to GitHub) is asked for by the
// commands that need it. Prints one block per failure with its fix.
//   exit 0: all passed   exit 1: something failed   exit 2: unknown check

import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DEFAULT_CHECKS, formatPreflight, runPreflight } from './lib/preflight.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { fingerprint, loadBaseline } from './lib/tree-baseline.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const checks = arg('checks') ? arg('checks').split(',').map((c) => c.trim()).filter(Boolean) : DEFAULT_CHECKS;
const run = (command, args) => {
  const r = spawnSync(command, args, { encoding: 'utf8' });
  return { status: r.error ? 127 : r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

// The files that the install step of the cloud job left changed before the agent started, as recorded by
// tree-baseline.mjs: they do not count as uncommitted work. Without a baseline (a local run) every change counts.
const baseline = loadBaseline(process.env.RELEVO_PROGRESS_DIR);
const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const installed = (path) => Boolean(baseline[path]) && fingerprint(git, path) === baseline[path];

try {
  const result = runPreflight({ checks, readConfig: () => readFileSync(resolve(arg('config') ?? 'relevo.yml'), 'utf8'), run, installed });
  const text = formatPreflight(result);
  if (result.ok) console.log(text);
  else console.error(text);
  process.exit(result.ok ? 0 : 1);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
