#!/usr/bin/env node
// Builds an issue on this machine, with your own Claude session, as the cloud would. Usage:
//   node scripts/go-local.mjs <issue> [--config relevo.yml] [--dry-run]
// It runs `claude -p "/relevo:go <issue>"` in a separate git worktree (so your uncommitted changes do not matter),
// with the turn and cost limits of relevo.yml and the closed tool lists of the workflow. The worktree is removed when
// the run ends cleanly and kept otherwise.
//   exit 0: done   exit 2: bad usage or something missing   other: the exit status of the run

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { runLocal } from './lib/go-local.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const issue = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--config');
const fail = (message, code = 2) => {
  console.error(message);
  process.exit(code);
};

const configPath = resolve(opt('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));

const runner = {
  capture: (cmd, cmdArgs, options) => execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: options.cwd }),
  stream: (cmd, cmdArgs, options) => {
    const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: options.cwd, env: { ...process.env, ...options.env } });
    if (r.error) throw r.error;
    return r.status ?? 1;
  },
};
const result = runLocal({
  issue,
  config: loaded.config,
  runner,
  dryRun: flag('dry-run'),
  workflowPresent: existsSync('.github/workflows/relevo-go.yml'),
  exists: existsSync,
});
result.messages.forEach((m) => console.log(m));
process.exit(result.status);
