#!/usr/bin/env node
// Checks that the tools which the profile of a platform lists are on the path of this machine. Usage:
//   node scripts/toolchain-check.mjs --platform <name> [--config relevo.yml] [--plugin-root <dir>]
// It prints { platform, stack, tools, missing } as JSON; `missing` also covers git, gh, jq and node, which every job needs. A tool is there when `<tool> --version` starts. The cloud build
// runs it before the agent, so that a runner without the SDK stops in seconds and not after a full run.
//   exit 0: every tool is there (or the profile lists none)   exit 1: a tool is missing, or the profile cannot be resolved
//   exit 2: bad usage or an invalid relevo.yml

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { missingTools, RUNNER_TOOLS } from './lib/toolchain-check.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message, code) => {
  console.error(message);
  process.exit(code);
};

const pluginRoot = resolve(arg('plugin-root') ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`, 2);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`, 2);

const names = Object.keys(loaded.config.platforms);
const name = arg('platform') ?? (names.length === 1 ? names[0] : undefined);
if (!name) fail(`usage: toolchain-check.mjs --platform <${names.join('|')}> [--config relevo.yml] [--plugin-root dir]`, 2);
const platform = loaded.config.platforms[name];
if (!platform) fail(`unknown platform "${name}"; the platforms of relevo.yml are: ${names.join(', ')}`, 2);

const base = dirname(configPath);
const read = (path) => {
  const file = path.startsWith('/') ? path : resolve(base, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};
const resolved = resolveProfile({ platform, pluginRoot, read });
if (!resolved.ok) fail(resolved.errors.join('\n'), 1);

const probe = (tool) => spawnSync(tool, ['--version'], { stdio: 'ignore' }).error === undefined;
const missing = missingTools([...RUNNER_TOOLS, ...(resolved.profile.tools ?? [])], probe);
console.log(JSON.stringify({ platform: name, stack: resolved.profile.stack, tools: resolved.profile.tools, missing }));
process.exit(missing.length > 0 ? 1 : 0);
