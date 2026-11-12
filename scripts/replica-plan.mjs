#!/usr/bin/env node
// The recipe of a replicated build and the model of a replica. Usage:
//   node scripts/replica-plan.mjs check --tasks tasks.md [--issue-file issue.md]
//       validates the recipe of tasks.md with no model. Prints { ok, replicated, template, replicas, problems }.
//       exit 0 ok (or not a replicated build)   exit 1 the recipe is wrong: the issue goes back with the reason `missing`
//   node scripts/replica-plan.mjs model --dev-model <model> --failures <n> [--config relevo.yml]
//       the model of one launch of a replica (one name below the developer's planned model, the planned model after two failures of
//       the same target). Prints { model, escalate, why }. exit 0 always, even when it cannot decide (then it keeps --dev-model).
//   node scripts/replica-plan.mjs template --section <K> --issue <n> [--base <branch>]
//       the files that the checkpoints of section K changed (the specification folder left out): the template of `Template: section K`.
//       A checkpoint is found by the tasks it names (its `Relevo-Tasks:` trailer, K.1, K.2...), never by the number of its group,
//       because a resumed run numbers its groups again. Prints { files, commits }.
//   node scripts/replica-plan.mjs template --k <n> --of <n> --issue <n> [--base <branch>]
//       the same for the checkpoint `wip: checkpoint k/n (#issue)`, for a caller that has the numbers.
//       exit 0; exit 1 when no such checkpoint exists (a checkpoint made before the trailer existed has no tasks to find it by); exit 2 bad arguments.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { parseIssueBody } from './lib/issue-parse.mjs';
import { checkRecipe, replicaModel } from './lib/replica-plan.mjs';
import { checkpointSubject, isCheckpoint, tasksOf } from './lib/wip-commit.mjs';
import { readFileSync } from './lib/guarded-fs.mjs';

const mode = process.argv[2];
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const usage = (m) => {
  console.error(m);
  process.exit(2);
};

if (mode === 'check') {
  if (!arg('tasks')) usage('usage: replica-plan.mjs check --tasks <tasks.md> [--issue-file <issue.md>]');
  let hasPattern = false;
  if (arg('issue-file') && existsSync(arg('issue-file'))) hasPattern = parseIssueBody(readFileSync(arg('issue-file'), 'utf8')).pattern !== null;
  const result = checkRecipe(readFileSync(arg('tasks'), 'utf8'), { hasPattern });
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
} else if (mode === 'model') {
  const devModel = arg('dev-model');
  if (!devModel) usage('usage: replica-plan.mjs model --dev-model <model> --failures <n> [--config relevo.yml]');
  try {
    const configPath = resolve(arg('config') ?? 'relevo.yml');
    const loaded = existsSync(configPath) ? loadConfig(readFileSync(configPath, 'utf8')) : { ok: false, errors: [{ message: `relevo.yml not found at ${configPath}` }] };
    if (!loaded.ok) {
      console.log(JSON.stringify({ model: devModel, escalate: false, why: `relevo.yml is not valid, so the replica keeps ${devModel}` }));
    } else {
      console.log(JSON.stringify(replicaModel({ config: loaded.config, devModel, failures: Number(arg('failures')) || 0 })));
    }
  } catch (error) {
    console.log(JSON.stringify({ model: devModel, escalate: false, why: `the replica model failed (${String(error.message).slice(0, 120)}), so it keeps ${devModel}` }));
  }
} else if (mode === 'template') {
  const issue = Number(arg('issue'));
  const section = arg('section');
  const [k, n] = ['k', 'of'].map((a) => Number(arg(a)));
  if (!issue || !(/^\d{1,3}$/.test(section ?? '') || (k && n))) usage('usage: replica-plan.mjs template --section <K> --issue <n> [--base <branch>]   (or --k <n> --of <n>)');
  const range = arg('base') ? [`origin/${arg('base')}..HEAD`] : [];
  const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const log = git(['log', ...range, '--format=%H%x1f%s%x1f%b%x1e']).split('\x1e').map((c) => c.replace(/^\n/, '')).filter((c) => c.trim()).map((c) => {
    const [sha, subject, body] = c.split('\x1f');
    return { sha: sha.trim(), subject: (subject ?? '').trim(), body: body ?? '' };
  });
  const wanted = section
    ? (c) => isCheckpoint(c.subject, issue) && tasksOf(c.body).some((t) => t.startsWith(`${section}.`))
    : (c) => c.subject === checkpointSubject(issue, k, n);
  const commits = log.filter(wanted).map((c) => c.sha);
  if (commits.length === 0) {
    console.log(JSON.stringify({ files: [], commits: [], detail: section ? `no checkpoint of #${issue} names a task of section ${section} (one made before the tasks were recorded names none)` : `no commit "${checkpointSubject(issue, k, n)}" on the branch` }));
    process.exit(1);
  }
  const files = [...new Set(commits.flatMap((sha) => git(['show', '--name-only', '--format=', sha]).split('\n').filter(Boolean)))].filter((f) => !f.startsWith('openspec/'));
  console.log(JSON.stringify({ files, commits }));
} else {
  usage('usage: replica-plan.mjs check|model|template ...');
}
