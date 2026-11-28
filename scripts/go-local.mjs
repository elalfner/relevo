#!/usr/bin/env node
// Builds an issue on this machine, with your own Claude or Antigravity session, as the cloud would. Usage:
//   node scripts/go-local.mjs <issue> [--config relevo.yml] [--agent claude|antigravity] [--dry-run] [--retry|--resume]
//   node scripts/go-local.mjs status <issue> [--config relevo.yml]
// --agent overrides agent.build for this local run (auto-detects Antigravity when run from an Antigravity runtime).
// --retry builds an issue that is `build-failed` and has no branch, without making it `ready` (so the cloud does not start it).
// --resume continues a `build-failed` issue from its branch (a build that stopped at a limit), building only the pending tasks; the planner
//          refuses a branch that cannot be continued and says why.
// It runs `claude -p "/relevo:go <issue>"` or `agent-guard.mjs run` in a separate git worktree (so your uncommitted changes do not matter),
// with the turn and cost/token limits of relevo.yml and the closed tool lists of the workflow. The worktree is removed when
// the run ends cleanly and kept otherwise. While it runs it prints a line when the phase, the group, the tasks or an
// agent change, and when it ends it says what the run used; its progress is kept beside the worktrees, and `status`
// prints it from another terminal (it only reads).
//   exit 0: done   exit 2: bad usage or something missing   other: the exit status of the run

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agySettings } from './lib/agent-guard.mjs';
import { loadConfig } from './lib/config.mjs';
import { realState } from './lib/build-state.mjs';
import { runLocal } from './lib/go-local.mjs';
import { localStatus } from './lib/local-status.mjs';
import { agyReadDenials, findRestrictedFiles, restrictedList } from './lib/restricted-paths.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const statusMode = args[0] === 'status';
const issue = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--config' && args[i - 1] !== '--agent' && !(statusMode && i === 0));
const fail = (message, code = 2) => {
  console.error(message);
  process.exit(code);
};

const configPath = resolve(opt('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));

const capture = (cmd, cmdArgs, options) => execFileSync(cmd, cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: options.cwd });

if (statusMode) {
  const result = localStatus({ issue, config: loaded.config, capture, state: realState, exists: existsSync });
  result.lines.forEach((l) => console.log(l));
  process.exit(result.status);
}

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prepareSettings = ({ out, worktree, config, env }) => {
  const list = restrictedList(config);
  const read = (p) => {
    const file = p.startsWith('/') ? p : resolve(worktree, p);
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  };
  const profiles = Object.values(config.platforms ?? {})
    .map((platform) => resolveProfile({ platform, pluginRoot, read }))
    .filter((r) => r.ok)
    .map((r) => r.profile);
  const restricted = agyReadDenials(findRestrictedFiles(worktree, list), list, worktree);
  const includeProvider = Boolean(env?.GEMINI_API_KEY);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), `${JSON.stringify(agySettings({ profiles, restricted, includeProvider }), null, 2)}\n`);
};

const runner = {
  capture,
  // Does not block: the progress is printed while the agent works. Its answer is captured, its errors go to the terminal.
  run: (cmd, cmdArgs, options) => new Promise((done, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'inherit'], cwd: options.cwd, env: { ...process.env, ...options.env } });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', (status) => done({ status: status ?? 1, stdout }));
  }),
};
let printed = 0;
const result = await runLocal({
  issue,
  config: loaded.config,
  runner,
  dryRun: flag('dry-run'),
  retry: flag('retry'),
  resume: flag('resume'),
  agent: opt('agent') ?? null,
  env: process.env,
  prepareSettings,
  removeSettings: (p) => rmSync(p, { force: true }),
  exists: existsSync,
  state: realState,
  print: (m) => { printed += 1; console.log(m); },
});
// Everything was printed as it came, except what a bad start returns without printing.
result.messages.slice(printed).forEach((m) => console.log(m));
process.exit(result.status);
