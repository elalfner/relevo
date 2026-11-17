#!/usr/bin/env node
// Plans what `go` should do. Reads GitHub (or a JSON file), prints the decisions as JSON.
//
//   node scripts/go-plan.mjs --repo owner/name [--config relevo.yml] [--place cloud|local] [--credential false] [--running 12,13] [--only 31] [--retry] [--apply] [--claim] [--github-output file]
//   node scripts/go-plan.mjs --input state.json  [--config relevo.yml] [--place cloud|local]
//
// --place   where the build would run: `cloud` (the default; the workflow) plans the issues that carry the `go` label, or
//           `local` (the skill, with no decision of the workflow) plans a `ready` issue for the person who runs it, with no label.
//           In the cloud, `go` on a `build-failed` issue with --only N is a rebuild when the issue has no branch on the remote.
//           With --input the person of `local` is `person` of the file, and `has_branch` of the issue says whether it has a branch.
// --only N  keeps only the decision for issue N (the whole queue is still planned, so limits stay correct).
// --retry   with --only N: plans the issue N, which must be `build-failed` and have no branch on the remote, as if the person who
//           runs this (the user of `gh`) had made it `ready`; the claim moves it from `build-failed` to `building`. It never adds `ready`,
//           so the cloud does not start. With --input the person is `retry_by` of the file and the branch is not looked for.
// --apply   carries out every decision except `start` (labels, assignees, comments).
// --claim   also carries out the `start` decision of the issue given by --only (marks it as building).
// --github-output FILE  appends `action=<decision action, or none>`, `decision_b64=<the decision as base64 JSON>` and, for a start,
//                       `platform=`, `stack=` and `path=` (empty otherwise)
//           to FILE (the GITHUB_OUTPUT file of a workflow step), so a later job can build without planning again.
//           Needs --only: it describes the decision of one issue.
// The `start` decisions are returned for the skill to build.
//   exit 0: planned   exit 2: invalid or missing configuration, or bad arguments

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { applyDecisions, gather, realGh, realGhLinks } from './lib/github.mjs';
import { planGo, withoutCredential } from './lib/plan.mjs';
import { resolveLabelNames } from './lib/labels.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

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

const place = arg('place') ?? 'cloud';
if (!['cloud', 'local'].includes(place)) fail('--place must be cloud or local');

const retryIssue = flag('retry') ? Number(arg('only')) : null;
if (flag('retry') && !Number.isInteger(retryIssue)) fail('--retry needs --only <issue>: it retries one issue');

const running = (arg('running') ?? '').split(',').filter(Boolean).map(Number);
let state;
let repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;

const onlyArg = arg('only') ? Number(arg('only')) : null;
let retry = null;
let person = null;
if (arg('input')) {
  state = JSON.parse(readFileSync(arg('input') === '-' ? 0 : arg('input'), 'utf8'));
  state.running = [...(state.running ?? []), ...running];
  if (retryIssue !== null) retry = { issue: retryIssue, by: state.retry_by ?? null };
  person = state.person ?? state.retry_by ?? null;
} else {
  if (!repo) fail('give --repo owner/name (or set GITHUB_REPOSITORY), or --input state.json');
  // The person is whoever the GitHub CLI is signed in as: it cannot be given as an argument.
  const whoAmI = () => {
    try {
      return JSON.parse(realGh(['api', 'user'])).login;
    } catch {
      return fail('could not tell who you are: sign in with `gh auth login`');
    }
  };
  if (place === 'local') person = whoAmI();
  if (retryIssue !== null) {
    const by = person ?? whoAmI();
    // A branch of the issue means there is something to correct, not to build again.
    let branches = '';
    try {
      branches = execFileSync('git', ['ls-remote', '--heads', 'origin', `refs/heads/feature/${retryIssue}-*`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
      fail('could not look for the branch of the issue on the remote: check the connection and run it again');
    }
    if (branches) fail(`#${retryIssue} already has a branch on the remote (${branches.split('\n')[0].split('\trefs/heads/')[1]}): run /relevo:fix ${retryIssue} to correct it, or delete the branch to build again`);
    retry = { issue: retryIssue, by };
  }
  state = gather({ gh: realGh, ghLinks: realGhLinks(), repo, config, running, retry, only: Number.isInteger(onlyArg) ? onlyArg : null, person });
  // A `go` label on a `build-failed` issue: a rebuild when nothing was pushed, `fix` when there is a branch. The API is asked, so the
  // `decide` job needs no checkout; a lookup that fails leaves it unknown and the planner builds nothing.
  const names = resolveLabelNames(config.labels);
  const target = state.issues.find((i) => i.number === onlyArg);
  if (place === 'cloud' && target && target.labels.includes(names.go) && target.labels.includes(names['build-failed'])) {
    try {
      const refs = JSON.parse(realGh(['api', `repos/${repo}/git/matching-refs/heads/feature/${onlyArg}-`]));
      target.has_branch = Array.isArray(refs) && refs.length > 0;
    } catch {
      target.has_branch = null;
    }
  }
}

// A state file may give the minutes of the recent builds as `recent_builds` (gather reads them itself from the workflow runs).
if (state.recent_builds !== undefined) state.recentBuilds = state.recent_builds;
const result = planGo({ config, repo, ...state, retry, place, person });
// `--credential false`: the workflow found no model credential, so nothing may be claimed for a cloud build.
if (arg('credential') === 'false') {
  result.decisions = withoutCredential(result.decisions, state.issues);
  result.summary = {};
  result.decisions.forEach((d) => { result.summary[d.action] = (result.summary[d.action] ?? 0) + 1; });
}

const only = onlyArg;
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
