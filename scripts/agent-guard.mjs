#!/usr/bin/env node
// The run guard and the settings of an Antigravity run. Usage:
//   node scripts/agent-guard.mjs settings --out <file> [--platform <name>] [--config relevo.yml] [--plugin-root <dir>]
//       writes the user-level settings of `agy` for the run: the key provider, the denied web and the allowed commands
//   node scripts/agent-guard.mjs run --prompt <text> --timeout-minutes <n> --summary <file> [--config relevo.yml]
//       [--max-turns <n>] [--max-tokens <n>] [--github-output <file>] [--agy <path>]
//       starts `agy -p` under the limits and writes the summary of the run (the same shape that run-usage.mjs reads).
//       The limits are limits.run_max_turns and limits.run_max_tokens of relevo.yml; a flag can only make one lower.
// exit codes of `run`: 0 success, 1 the agent failed, 10 a tool was refused, 11 turn limit, 12 token limit, 13 time limit,
// 14 no result; 2 bad usage. The agent's output is never printed: the log has one line per step, and the final answer.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT, agySettings, runGuard } from './lib/agent-guard.mjs';
import { loadConfig } from './lib/config.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';

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
  let profile = null;
  const configPath = resolve(arg('config') ?? 'relevo.yml');
  if (existsSync(configPath)) {
    const loaded = loadConfig(readFileSync(configPath, 'utf8'));
    if (!loaded.ok) usage(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);
    const names = Object.keys(loaded.config.platforms);
    const name = arg('platform') ?? (names.length === 1 ? names[0] : undefined);
    if (!name || !loaded.config.platforms[name]) usage(`the platform must be one of: ${names.join(', ')}`);
    const base = dirname(configPath);
    const read = (p) => {
      const file = p.startsWith('/') ? p : resolve(base, p);
      return existsSync(file) ? readFileSync(file, 'utf8') : null;
    };
    const resolved = resolveProfile({ platform: loaded.config.platforms[name], pluginRoot, read });
    if (!resolved.ok) usage(resolved.errors.join('\n'));
    profile = resolved.profile;
  }
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), `${JSON.stringify(agySettings({ profile }), null, 2)}\n`);
  console.log(`settings written to ${out}`);
  process.exit(0);
}

if (mode === 'run') {
  const prompt = arg('prompt');
  const summaryFile = arg('summary');
  if (!prompt || !summaryFile) usage('run needs --prompt and --summary');
  let fromConfig = { turns: null, tokens: null };
  const configPath = resolve(arg('config') ?? 'relevo.yml');
  if (arg('config') !== undefined || existsSync(configPath)) {
    if (!existsSync(configPath)) usage(`relevo.yml not found at ${configPath}`);
    const loaded = loadConfig(readFileSync(configPath, 'utf8'));
    if (!loaded.ok) usage(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`);
    fromConfig = { turns: loaded.config.limits.run_max_turns ?? null, tokens: loaded.config.limits.run_max_tokens ?? null };
  }
  const limits = { turns: lower('max-turns', fromConfig.turns), tokens: lower('max-tokens', fromConfig.tokens), minutes: positive('timeout-minutes') };
  const agy = arg('agy') ?? 'agy';
  const args = ['-p', prompt, '--output-format', 'stream-json', '--print-timeout', `${Math.ceil(limits.minutes) + 1}m`];
  const start = (command, a) => {
    const child = spawn(command, a, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.on('error', (err) => child.stderr.emit('data', `${err.message}\n`));
    return { pid: child.pid, stdout: child.stdout, stderr: child.stderr, kill: (signal) => process.kill(-child.pid, signal), on: (ev, cb) => child.on(ev, cb) };
  };
  const { code, summary, response } = await runGuard({ command: agy, args, limits, spawn: start, log: (line) => console.error(line) });
  mkdirSync(dirname(resolve(summaryFile)), { recursive: true });
  writeFileSync(resolve(summaryFile), `${JSON.stringify(summary, null, 2)}\n`);
  if (arg('github-output')) appendFileSync(arg('github-output'), `execution_file=${resolve(summaryFile)}\n`);
  if (response) console.log(response);
  console.error(`relevo guard: ${summary.num_turns} turns, ${summary.usage.input_tokens + summary.usage.output_tokens} tokens, ${summary.duration_seconds}s, exit ${code}`);
  process.exit(code);
}

usage(`unknown mode "${mode ?? ''}"`);
