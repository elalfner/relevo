#!/usr/bin/env node
// Resolves the extra skills of a role to the files an agent may read. Usage:
//   node scripts/role-skills.mjs --role <dev|qa|issue|review|fix> [--platform <name>] [--base origin/dev] [--config relevo.yml]
// Prints JSON: { role, platform, base, skills: [ { name, path, scripts } | { name, left_out, reason } ] }.
// Only skills present on the base branch are used, so a skill added by the branch is never trusted.
//   exit 0: printed (skills may be left out)   exit 1: the profile cannot be resolved   exit 2: bad usage or invalid relevo.yml

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { resolveRoleSkills, skillDirsFor } from './lib/role-skills.mjs';
import { resolveProfile } from './lib/stack-profile.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message, code) => {
  console.error(message);
  process.exit(code);
};

const role = arg('role');
if (!role) fail('usage: role-skills.mjs --role <dev|qa|issue|review|fix> [--platform name] [--base origin/dev] [--config relevo.yml]', 2);
const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`, 2);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`, 2);

const names = Object.keys(loaded.config.platforms);
const name = arg('platform') ?? (names.length === 1 ? names[0] : undefined);
const platform = name ? loaded.config.platforms[name] : undefined;
if (!platform) fail(`give --platform <${names.join('|')}>`, 2);

const base = dirname(configPath);
const read = (path) => {
  const file = path.startsWith('/') ? path : resolve(base, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resolved = resolveProfile({ platform, pluginRoot, read });
if (!resolved.ok) fail(resolved.errors.join('\n'), 1);

const baseRef = arg('base') ?? `origin/${loaded.config.branches.base}`;
const git = (args) => execFileSync('git', args, { cwd: base, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const skills = resolveRoleSkills({ role, profile: resolved.profile, git, baseRef, allowScripts: loaded.config.skills.allow_scripts, dirs: skillDirsFor(platform.path) });
  console.log(JSON.stringify({ role, platform: name, base: baseRef, skills }, null, 2));
} catch (err) {
  fail(err.message, 2);
}
