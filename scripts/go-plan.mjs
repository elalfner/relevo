#!/usr/bin/env node
// Plans what `go` should do. Reads GitHub (or a JSON file), prints the decisions as JSON.
//
//   node scripts/go-plan.mjs --repo owner/name [--config relevo.yml] [--running 12,13] [--only 31] [--apply] [--claim] [--github-output file]
//   node scripts/go-plan.mjs --input state.json  [--config relevo.yml]
//
// --only N  keeps only the decision for issue N (the whole queue is still planned, so limits stay correct).
// --apply   carries out every decision except `start` (labels, assignees, comments).
// --claim   also carries out the `start` decision of the issue given by --only (marks it as building).
// --github-output FILE  appends `action=<decision action, or none>`, `decision_b64=<the decision as base64 JSON>` and, for a start,
//                       `platform=`, `stack=` and `path=` (empty otherwise)
//           to FILE (the GITHUB_OUTPUT file of a workflow step), so a later job can build without planning again.
//           Needs --only: it describes the decision of one issue.
// The `start` decisions are returned for the skill to build.
//   exit 0: planned   exit 2: invalid or missing configuration, or bad arguments

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
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
if (arg('github-output')) {
  if (only === null) fail('--github-output needs --only <issue>: it describes the decision of one issue');
  const decision = result.decisions[0] ?? null;
  const encoded = decision ? Buffer.from(JSON.stringify(decision), 'utf8').toString('base64') : '';
  // The build job installs the toolchain of the stack of the platform; the values are empty unless the decision is `start`.
  const start = decision?.action === 'start' ? decision : {};
  appendFileSync(arg('github-output'), `action=${decision ? decision.action : 'none'}\ndecision_b64=${encoded}\nplatform=${start.platform ?? ''}\nstack=${start.stack ?? ''}\npath=${start.path ?? ''}\n`);
}
console.log(JSON.stringify(result, null, 2));
