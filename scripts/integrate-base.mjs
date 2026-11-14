#!/usr/bin/env node
// Merges the base branch into the branch of a build before the hand-off.
//
//   node scripts/integrate-base.mjs --base <base> [--config relevo.yml] [--within <path>]
//   prints {"outcome":"unchanged|merged|regenerated|conflict|failed","files":[...],"message":"..."}
//   exit 0: unchanged, merged or regenerated   exit 1: conflict in a file that is not generated   exit 2: could not complete, or bad arguments
//
// It fetches origin/<base>, probes the merge in memory, and merges when that is safe. A conflict in a file that matches
// `integration.generated` is resolved by running `integration.regenerate` from --within (the folder of the platform).
// Nothing is pushed. With a conflict or a failure the working tree is left as it was.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { integrateBase } from './lib/integrate-base.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const base = arg('base');
if (!base) fail('usage: integrate-base.mjs --base <base> [--config relevo.yml] [--within <path>]');
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
const { integration } = loaded.config;

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' });
const fetched = git('fetch', '--quiet', 'origin', base);
if (fetched.status !== 0) fail(`could not fetch origin/${base}: ${String(fetched.stderr).trim()}`);

const within = arg('within');
const result = integrateBase({
  run: git,
  runCommand: (command) => spawnSync('sh', ['-c', command], { encoding: 'utf8', cwd: within && within !== '.' ? resolve(within) : process.cwd() }),
  base: `origin/${base}`,
  generated: integration.generated,
  regenerate: integration.regenerate,
});
console.log(JSON.stringify(result));
process.exit(result.outcome === 'conflict' ? 1 : result.outcome === 'failed' ? 2 : 0);
