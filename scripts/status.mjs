#!/usr/bin/env node
// Who is waiting on what. Read-only: it never changes an issue, label or branch.
//   node scripts/status.mjs --repo owner/name [--me login] [--json] [--config relevo.yml]
//   node scripts/status.mjs --input state.json [--me login] [--now ISO] [--json]
// exit 0: reported   exit 2: invalid configuration or bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { realGh } from './lib/github.mjs';
import { buildStatus, renderStatus } from './lib/status.mjs';
import { gatherStatus } from './lib/status-data.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const fail = (m) => {
  console.error(m);
  process.exit(2);
};

const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
const { config } = loaded;

const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
let data;
if (arg('input')) {
  data = JSON.parse(readFileSync(arg('input') === '-' ? 0 : arg('input'), 'utf8'));
} else {
  if (!repo) fail('give --repo owner/name (or set GITHUB_REPOSITORY), or --input state.json');
  data = gatherStatus({ gh: realGh, repo, config });
}
let me = arg('me') ?? null;
if (!me && !arg('input')) {
  try {
    me = JSON.parse(realGh(['api', 'user'])).login;
  } catch {
    me = null;
  }
}

const report = buildStatus({ config, ...data, me, now: arg('now') ? new Date(arg('now')) : new Date() });
console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : renderStatus(report, config.language));
