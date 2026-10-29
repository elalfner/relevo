#!/usr/bin/env node
// Sends the review reminder, then the escalation. Usage:
//   node scripts/review-sla.mjs --repo owner/name [--config relevo.yml] [--dry-run]
//   node scripts/review-sla.mjs --input prs.json [--now ISO] [--config relevo.yml]   (never writes)
// Prints the decisions as JSON.   exit 0: evaluated   exit 2: invalid configuration or bad arguments

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { realGh } from './lib/github.mjs';
import { gatherPrs, planSla, slaCommands } from './lib/sla.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

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
const now = arg('now') ? new Date(arg('now')) : new Date();
let prs;
if (arg('input')) {
  prs = JSON.parse(readFileSync(arg('input') === '-' ? 0 : arg('input'), 'utf8'));
} else {
  if (!repo) fail('give --repo owner/name (or set GITHUB_REPOSITORY), or --input prs.json');
  prs = gatherPrs({ gh: realGh, repo, config });
}

const decisions = planSla({ config, prs, now });
const dry = process.argv.includes('--dry-run') || Boolean(arg('input'));
if (!dry) decisions.forEach((d) => slaCommands(d, { repo, config }).forEach((cmd) => realGh(cmd)));
console.log(JSON.stringify({ decisions }, null, 2));
