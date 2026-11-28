#!/usr/bin/env node
// The run guard and the settings of an Antigravity run. Usage:
//   node scripts/agent-guard.mjs settings --out <file> [--platform <name>] [--config relevo.yml] [--plugin-root <dir>] [--root <tree>]
//       writes the user-level settings of `agy` for the run: the key provider, the denied web, a read denial for each
//       restricted file that exists in the tree (by exact path: the tool matches no glob) and the allowed commands
//   node scripts/agent-guard.mjs run --prompt <text> --timeout-minutes <n> --summary <file> [--config relevo.yml]
//       [--max-turns <n>] [--max-tokens <n>] [--github-output <file>] [--agy <path>]
//       starts `agy -p` under the limits and writes the summary of the run (the same shape that run-usage.mjs reads).
//       The limits are limits.run_max_turns and limits.run_max_tokens of relevo.yml; a flag can only make one lower.
// exit codes of `run`: 0 success, 1 the agent failed, 10 a tool was refused, 11 turn limit, 12 token limit, 13 time limit,
// 14 no result; 2 bad usage. The agent's output is never printed: the log has one line per step, and the final answer.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT, agySettings, buildAgyArgs, runGuard } from './lib/agent-guard.mjs';
import { agentsFor, loadConfig } from './lib/config.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { agyReadDenials, findRestrictedFiles, restrictedList } from './lib/restricted-paths.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const [mode, ...rest] = process.argv.slice(2);
const arg = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
};
const usage = (message) => {
  console.error(`${message}\nusage: agent-guard.mjs settings --out <file> [--platform <name>] | run --prompt <text> --max-turns <n> --max-tokens <n> --timeout-minutes <n> --summary <file>`);
  process.exit(EXIT.usage);
};
const positive = (name, fallback = null) => {
  const given = arg(name);
  const v = given === undefined && fallback !== null ? fallback : Number(given);
  if (!Number.isFinite(v) || v <= 0) usage(`--${name} must be a number greater than zero${fallback === null ? '' : ' (or set it in relevo.yml)'}`);
  return v;
};
const lower = (flag, fromConfig) => (arg(flag) === undefined || fromConfig === null ? positive(flag, fromConfig) : Math.min(positive(flag), fromConfig));

if (mode === 'settings') {
  const out = arg('out');
  if (!out) usage('settings needs --out');
  const pluginRoot = resolve(arg('plugin-root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const profiles = [];
  let list = restrictedList();
  const configPath = resolve(arg('config') ?? 'relevo.yml');
  const localMode = rest.includes('--local');
  const allPlatforms = rest.includes('--all-platforms');
  // The tree the agent works in: where relevo.yml is, or the current folder. Its restricted files are found by name.
  const treeRoot = resolve(arg('root') ?? (existsSync(configPath) ? dirname(configPath) : '.'));
  if (existsSync(configPath)) {
    const loaded = loadConfig(readFileSync(configPath, 'utf8'));
    if (!loaded.ok) usage(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);
    list = restrictedList(loaded.config);
    const names = Object.keys(loaded.config.platforms);
    const base = dirname(configPath);
    const read = (p) => {
      const file = p.startsWith('/') ? p : resolve(base, p);
      return existsSync(file) ? readFileSync(file, 'utf8') : null;
    };
    const selected = allPlatforms ? names : [arg('platform') ?? (names.length === 1 ? names[0] : undefined)];
    if (!allPlatforms && (!selected[0] || !loaded.config.platforms[selected[0]])) usage(`the platform must be one of: ${names.join(', ')}`);
    for (const name of selected) {
      const resolved = resolveProfile({ platform: loaded.config.platforms[name], pluginRoot, read });
      if (!resolved.ok) usage(resolved.errors.join('\n'));
      profiles.push(resolved.profile);
    }
  }
  mkdirSync(dirname(resolve(out)), { recursive: true });
  const restricted = agyReadDenials(findRestrictedFiles(treeRoot, list), list, treeRoot);
  const includeProvider = localMode ? Boolean(process.env.GEMINI_API_KEY) : true;
  writeFileSync(resolve(out), `${JSON.stringify(agySettings({ profiles, restricted, includeProvider }), null, 2)}\n`);
  console.log(`settings written to ${out}${restricted.length > 0 ? ` (read denied for ${restricted.length} restricted file${restricted.length === 1 ? '' : 's'}, by exact path)` : ''}`);
  process.exit(0);
}

if (mode === 'run') {
  const prompt = arg('prompt');
  const summaryFile = arg('summary');
  if (!prompt || !summaryFile) usage('run needs --prompt and --summary');
  let fromConfig = { turns: null, tokens: null };
  let mainFromConfig = null;
  const configPath = resolve(arg('config') ?? 'relevo.yml');
  if (arg('config') !== undefined || existsSync(configPath)) {
    if (!existsSync(configPath)) usage(`relevo.yml not found at ${configPath}`);
    const loaded = loadConfig(readFileSync(configPath, 'utf8'));
    if (!loaded.ok) usage(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);
    fromConfig = { turns: loaded.config.limits.run_max_turns ?? null, tokens: loaded.config.limits.run_max_tokens ?? null };
    mainFromConfig = agentsFor(loaded.config, 'antigravity').main ?? null;
  }
  const limits = { turns: lower('max-turns', fromConfig.turns), tokens: lower('max-tokens', fromConfig.tokens), minutes: positive('timeout-minutes') };
  const agy = arg('agy') ?? 'agy';
  const model = arg('model') ?? mainFromConfig?.model ?? null;
  const effort = arg('effort') ?? mainFromConfig?.effort ?? null;
  const settings = arg('settings') ?? null;
  const args = buildAgyArgs({ prompt, timeoutMinutes: limits.minutes, model, effort, settings });
  const start = (command, a) => {
    const child = spawn(command, a, { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RELEVO_AGENT: 'antigravity' } });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.on('error', (err) => child.stderr.emit('data', `${err.message}\n`));
    return { pid: child.pid, stdout: child.stdout, stderr: child.stderr, kill: (signal) => process.kill(-child.pid, signal), on: (ev, cb) => child.on(ev, cb) };
  };
  const readTranscript = (p) => {
    try {
      return existsSync(p) ? readFileSync(p, 'utf8') : null;
    } catch {
      return null;
    }
  };
  const { code, summary, response } = await runGuard({ command: agy, args, limits, spawn: start, log: (line) => console.error(line), readFile: readTranscript });
  mkdirSync(dirname(resolve(summaryFile)), { recursive: true });
  writeFileSync(resolve(summaryFile), `${JSON.stringify(summary, null, 2)}\n`);
  if (arg('github-output')) appendFileSync(arg('github-output'), `execution_file=${resolve(summaryFile)}\n`);
  if (response) console.log(response);
  console.error(`relevo guard: ${summary.num_turns} turns, ${summary.usage.input_tokens + summary.usage.output_tokens} tokens, ${summary.duration_seconds}s, exit ${code}`);
  process.exit(code);
}

usage(`unknown mode "${mode ?? ''}"`);
