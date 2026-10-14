#!/usr/bin/env node
// Plans what `go` should do. Reads GitHub (or a JSON file), prints the decisions as JSON.
//
//   node scripts/go-plan.mjs --repo owner/name [--config relevo.yml] [--running 12,13] [--only 31] [--apply] [--claim]
//   node scripts/go-plan.mjs --input state.json  [--config relevo.yml]
//
// --only N  keeps only the decision for issue N (the whole queue is still planned, so limits stay correct).
// --apply   carries out every decision except `start` (labels, assignees, comments).
// --claim   also carries out the `start` decision of the issue given by --only (marks it as building).
// The `start` decisions are returned for the skill to build.
//   exit 0: planned   exit 2: invalid or missing configuration, or bad arguments

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { applyDecisions, gather, realGh } from './lib/github.mjs';
import { planGo } from './lib/plan.mjs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const flag = (name) => process.argv.includes(`--${name}`);
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const configPath = resolve(arg('config') ?? 'relevo.yml');
if (!existsSync(configPath)) fail(`relevo.yml not found at ${configPath}. Run /relevo:init to create it.`);
const loaded = loadConfig(readFileSync(configPath, 'utf8'));
if (!loaded.ok) fail(loaded.errors.map((e) => `error: ${e.message}`).join('\n'));
const { config } = loaded;

const running = (arg('running') ?? '').split(',').filter(Boolean).map(Number);
let state;
let repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;

if (arg('input')) {
  state = JSON.parse(readFileSync(arg('input') === '-' ? 0 : arg('input'), 'utf8'));
  state.running = [...(state.running ?? []), ...running];
} else {
  if (!repo) fail('give --repo owner/name (or set GITHUB_REPOSITORY), or --input state.json');
  state = gather({ gh: realGh, repo, config, running });
}

const result = planGo({ config, ...state });

const only = arg('only') ? Number(arg('only')) : null;
if (only !== null) {
  if (!Number.isInteger(only)) fail('--only needs an issue number');
  result.decisions = result.decisions.filter((d) => d.issue === only);
  result.summary = {};
  result.decisions.forEach((d) => {
    result.summary[d.action] = (result.summary[d.action] ?? 0) + 1;
  });
}
if (flag('claim') && only === null) fail('--claim needs --only <issue>: it marks one issue as building');

if (flag('apply') || flag('claim')) {
  if (!repo) fail('--apply and --claim need --repo owner/name');
  result.applied = applyDecisions(result.decisions, { gh: realGh, repo, config, includeStart: flag('claim') }).length;
}
console.log(JSON.stringify(result, null, 2));
