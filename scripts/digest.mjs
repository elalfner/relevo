#!/usr/bin/env node
// Posts the daily digest as a comment on the issue named by digest.issue (chat tools subscribe to GitHub events).
// Posts nothing when nothing is waiting, and nothing on weekends.
//   node scripts/digest.mjs --repo owner/name [--config relevo.yml] [--dry-run] [--now ISO]
//   node scripts/digest.mjs --input state.json [--now ISO]     (never writes; the file may hold `usage`, the parsed runs, and `stages`, the samples of the stages)
// Prints the digest text, or nothing.   exit 0: done   exit 2: invalid configuration or bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { realGh, realGhLinks } from './lib/github.mjs';
import { buildStatus, renderDigest } from './lib/status.mjs';
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

const now = arg('now') ? new Date(arg('now')) : new Date();
const day = now.getUTCDay();
if (day === 0 || day === 6) process.exit(0);

const repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;
let data;
if (arg('input')) {
  data = JSON.parse(readFileSync(arg('input') === '-' ? 0 : arg('input'), 'utf8'));
} else {
  if (!repo) fail('give --repo owner/name (or set GITHUB_REPOSITORY), or --input state.json');
  data = gatherStatus({ gh: realGh, ghLinks: realGhLinks(), repo, config, withUsage: true, withStages: true, now });
}

const text = renderDigest(buildStatus({ config, ...data, me: null, now }), config.language);
if (!text) process.exit(0);
const dry = process.argv.includes('--dry-run') || Boolean(arg('input'));
if (!dry) {
  if (!config.digest.issue) fail('digest.issue is not set in relevo.yml: name the issue where the digest is posted');
  realGh(['issue', 'comment', String(config.digest.issue), '--repo', repo, '--body', text]);
}
console.log(text);
