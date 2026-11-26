#!/usr/bin/env node
// Plans what `go` should do. Reads GitHub (or a JSON file), prints the decisions as JSON.
//
//   node scripts/go-plan.mjs --repo owner/name [--config relevo.yml] [--place cloud|local] [--credential false] [--running 12,13] [--only 31] [--retry|--resume] [--apply] [--claim] [--github-output file]
//   node scripts/go-plan.mjs --input state.json  [--config relevo.yml] [--place cloud|local]
//
// --place   where the build would run: `cloud` (the default; the workflow) plans the issues that carry the `go` label, or
//           `local` (the skill, with no decision of the workflow) plans a `ready` issue for the person who runs it, with no label.
//           In the cloud, `go` on a `build-failed` issue with --only N is a rebuild when the issue has no branch on the remote.
//           With --input the person of `local` is `person` of the file, and `has_branch` of the issue says whether it has a branch.
// --only N  also reads when the body of issue N was last edited, so that the planner checks the approval before any gate: a text
//           edited after `ready` is not built. Only that issue is read (one GraphQL query). With --input it is `last_edited` of the
//           file, keyed by issue number (`{ "7": { "ok": true, "at": null } }`); without it the body is not checked there.
// --only N  keeps only the decision for issue N (the whole queue is still planned, so limits stay correct).
// --retry   with --only N: plans the issue N, which must be `build-failed` and have no branch on the remote (when the branch holds only
//           the specification the refusal says how to delete it; nothing is deleted), as if the person who
//           runs this (the user of `gh`) had made it `ready`; the claim moves it from `build-failed` to `building`. It never adds `ready`,
//           so the cloud does not start. With --input the person is `retry_by` of the file and the branch is not looked for.
// --resume  with --only N: continues the `build-failed` issue N from its branch (a build that stopped at a limit or was cut), as if the person
//           who runs this had made it `ready`; the claim moves it from `build-failed` to `building`. The branch must be one that the resume
//           check accepts, and a resume that finished no task needs a higher limit in relevo.yml first. Otherwise nothing changes and the
//           message names the reason and the step that fits. With --input the issue carries `resume_check` and `stalled`.
//           In the cloud, `go` on a `build-failed` issue whose branch the check accepts is the same resume.
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
import { applyDecisions, gather, readLastEdited, realGh, realGhLinks } from './lib/github.mjs';
import { planGo, withoutCredential } from './lib/plan.mjs';
import { resolveLabelNames } from './lib/labels.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';
import { readBranchKind, resumeRefusal, retryRefusal } from './lib/retry-refusal.mjs';
import { branchOf as remoteBranchOf, resumeCheckFor } from './lib/resume-lookup.mjs';
import { latestStalled } from './lib/stalled-marker.mjs';
import { resumeState } from './lib/resume-check.mjs';
import { issueHash } from './lib/issue-hash.mjs';
import { applyFiles, planFiles } from './lib/plan-files.mjs';
import { loadTracker } from './lib/tracker/load.mjs';

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

// A files project has one person and builds on this machine: no repository, no cloud, no team gates.
if (config.tracker === 'files') {
  if (place !== 'local') fail('a files project builds only on this machine: use --place local');
  const only = arg('only') ? Number(arg('only')) : null;
  if (flag('claim') && !Number.isInteger(only)) fail('--claim needs --only <issue>: it marks one issue as building');
  const { tracker } = loadTracker({ configPath });
  const branchOf = (n) => { try { return execFileSync('git', ['branch', '--list', `feature/${n}-*`], { encoding: 'utf8' }).trim() !== ''; } catch { return false; } };
  const resumeFiles = flag('resume');
  if (resumeFiles && flag('retry')) fail('--resume and --retry cannot be given together: --resume continues from the branch, --retry builds from the beginning');
  if (resumeFiles && !Number.isInteger(only)) fail('--resume needs --only <issue>: it resumes one issue');
  const resumeCheck = (n) => {
    try {
      const full = tracker.issueGet(n);
      const branch = execFileSync('git', ['branch', '--list', `feature/${n}-*`, '--format=%(refname:short)'], { encoding: 'utf8' }).trim().split('\n')[0];
      const git = (a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
      return resumeState({ git, base: config.branches.base, branch, issue: n, issueHash: issueHash({ title: full.title, body: full.body }), local: true });
    } catch (error) {
      return { state: 'existing', reason: `the branch could not be read: ${String(error?.message ?? error).split('\n')[0].slice(0, 160)}` };
    }
  };
  const result = planFiles({ config, tracker, only: Number.isInteger(only) ? only : null, retry: flag('retry'), resume: resumeFiles, hasBranch: branchOf, resumeCheck, stalled: (n) => latestStalled(tracker.commentsList(n).map((c) => ({ user: { type: 'Bot' }, body: c.body }))) });
  if (flag('apply') || flag('claim')) result.applied = applyFiles(result.decisions, { tracker, includeStart: flag('claim') });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const retryIssue = flag('retry') ? Number(arg('only')) : null;
if (flag('retry') && !Number.isInteger(retryIssue)) fail('--retry needs --only <issue>: it retries one issue');
if (flag('resume') && flag('retry')) fail('--resume and --retry cannot be given together: --resume continues from the branch, --retry builds from the beginning');
const resumeIssue = flag('resume') ? Number(arg('only')) : null;
if (flag('resume') && !Number.isInteger(resumeIssue)) fail('--resume needs --only <issue>: it resumes one issue');

const running = (arg('running') ?? '').split(',').filter(Boolean).map(Number);
let state;
let repo = arg('repo') ?? process.env.GITHUB_REPOSITORY;

const onlyArg = arg('only') ? Number(arg('only')) : null;
let retry = null;
let resume = null;
let person = null;
if (arg('input')) {
  state = JSON.parse(readFileSync(arg('input') === '-' ? 0 : arg('input'), 'utf8'));
  state.running = [...(state.running ?? []), ...running];
  if (retryIssue !== null) retry = { issue: retryIssue, by: state.retry_by ?? null };
  if (resumeIssue !== null) resume = { issue: resumeIssue, by: state.retry_by ?? null };
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
    if (branches) {
      const branch = branches.split('\n')[0].split('\trefs/heads/')[1];
      fail(retryRefusal({ issue: retryIssue, branch, kind: readBranchKind({ base: config.branches.base, branch }), resume: resumeCheckFor({ gh: realGh, repo, number: retryIssue, base: config.branches.base, branch }) }));
    }
    retry = { issue: retryIssue, by };
  }
  if (resumeIssue !== null) resume = { issue: resumeIssue, by: person ?? whoAmI() };
  state = gather({ gh: realGh, ghLinks: realGhLinks(), repo, config, running, retry: retry ?? (resume ? { issue: resume.issue } : null), only: Number.isInteger(onlyArg) ? onlyArg : null, person });
  // The issue about to be claimed: when its body was last edited. A failure is passed on as it is, so nothing is built.
  if (Number.isInteger(onlyArg)) state.last_edited = { [onlyArg]: readLastEdited({ gh: realGh, repo, number: onlyArg }) };
  // A `go` label on a `build-failed` issue: a rebuild when nothing was pushed, `fix` when there is a branch. The API is asked, so the
  // `decide` job needs no checkout; a lookup that fails leaves it unknown and the planner builds nothing.
  const names = resolveLabelNames(config.labels);
  const target = state.issues.find((i) => i.number === onlyArg);
  const wantsBranch = target && target.labels.includes(names['build-failed']) && ((place === 'cloud' && target.labels.includes(names.go)) || resume !== null);
  if (wantsBranch) {
    let branch = null;
    try {
      branch = remoteBranchOf({ gh: realGh, repo, number: onlyArg });
      target.has_branch = branch !== null;
    } catch {
      target.has_branch = null;
    }
    // A branch there is: ask the check whether a run may continue from it, and what the last stop recorded about its progress. The same
    // answer serves the label in the cloud and `--resume` on a machine. A comment list that cannot be read leaves the stall out, as it does elsewhere.
    if (branch !== null) {
      target.resume_check = resumeCheckFor({ gh: realGh, repo, number: onlyArg, base: config.branches.base, branch, title: target.title, body: target.body });
      try {
        target.stalled = latestStalled(JSON.parse(realGh(['api', `repos/${repo}/issues/${onlyArg}/comments?per_page=100`, '--paginate', '--slurp'])).flat());
      } catch {
        target.stalled = null;
      }
      // On a machine the refusal of `--resume` says why and where to go; the cloud label keeps the comment it has (see plan.mjs).
      if (resume !== null && target.resume_check.state !== 'resume') {
        fail(resumeRefusal({ issue: onlyArg, branch, check: target.resume_check, kind: readBranchKind({ base: config.branches.base, branch }) }));
      }
    } else if (resume !== null && target.has_branch === false) {
      fail(resumeRefusal({ issue: onlyArg, branch: null, check: { state: 'absent', reason: null }, kind: null }));
    }
  }
}

// A state file may give the minutes of the recent builds as `recent_builds` (gather reads them itself from the workflow runs).
if (state.recent_builds !== undefined) state.recentBuilds = state.recent_builds;
const edits = state.last_edited ?? null;
const result = planGo({ config, repo, ...state, retry, resume, place, person, edits, only: place === 'local' && Number.isInteger(onlyArg) ? onlyArg : null });
// `--credential false`: the workflow found no model credential, so nothing may be claimed for a cloud build.
if (arg('credential') === 'false') {
  result.decisions = withoutCredential(result.decisions, state.issues, config.labels);
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
