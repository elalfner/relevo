#!/usr/bin/env node
// Prints the platform an issue belongs to, as JSON. Usage:
//   node scripts/platform-of.mjs --issue <n> [--repo owner/name] [--config relevo.yml]
//   node scripts/platform-of.mjs --input issue.json [--config relevo.yml]     (issue.json: { "body": "..." }, for tests)
// Output: { platform, stack, path, targets }. `fix` and `review` use it to find the stack again from the issue text.
//   exit 0: printed   exit 1: the platform cannot be resolved (the reason is on stderr)   exit 2: bad usage or invalid relevo.yml

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { resolvePlatform } from './lib/platform-of.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (message, code) => {
  console.error(message);
  process.exit(code);
};

const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`, 2);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(`relevo.yml is invalid:\n${loaded.errors.map((e) => `  ${e.message}`).join('\n')}`, 2);

let body;
if (arg('input')) {
  try {
    body = JSON.parse(readFileSync(arg('input'), 'utf8')).body ?? '';
  } catch (err) {
    fail(`cannot read ${arg('input')}: ${err.message}`, 2);
  }
} else if (arg('issue')) {
  const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
  const args = ['issue', 'view', arg('issue'), '--json', 'body', '--jq', '.body', ...(repo ? ['--repo', repo] : [])];
  try {
    body = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    fail(`cannot read issue ${arg('issue')}: ${String(err.stderr ?? err.message).trim()}`, 2);
  }
} else {
  fail('usage: platform-of.mjs --issue <n> [--repo owner/name] [--config relevo.yml]', 2);
}

const r = resolvePlatform({ platforms: loaded.config.platforms, body });
if (!r.ok) fail(r.reason === 'missing' ? `the issue has no ${r.message}` : r.message, 1);
console.log(JSON.stringify({ platform: r.name, stack: r.entry.stack, path: r.entry.path, targets: r.entry.targets }, null, 2));
