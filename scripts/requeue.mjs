#!/usr/bin/env node
// Re-evaluates the queue. Carries out every decision except `start` (labels, comments) and prints
// which issues may start now, so a workflow can dispatch one build run for each.
//
//   node scripts/requeue.mjs --repo owner/name [--config relevo.yml] [--dry-run]
//   node scripts/requeue.mjs --input state.json [--config relevo.yml]
//   prints {"start":[12,15],"summary":{...}}
//   exit 0: evaluated   exit 2: invalid or missing configuration, or bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { applyDecisions, gather, realGh } from './lib/github.mjs';
import { planGo } from './lib/plan.mjs';
import { startable } from './lib/requeue.mjs';

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
let state;
if (arg('input')) {
  state = JSON.parse(readFileSync(arg('input') === '-' ? 0 : arg('input'), 'utf8'));
} else {
  if (!repo) fail('give --repo owner/name (or set GITHUB_REPOSITORY), or --input state.json');
  state = gather({ gh: realGh, repo, config });
}

const { decisions, summary } = planGo({ config, ...state });
const dry = process.argv.includes('--dry-run') || Boolean(arg('input'));
if (!dry) applyDecisions(decisions, { gh: realGh, repo, config });
console.log(JSON.stringify({ start: startable(decisions), summary }));
