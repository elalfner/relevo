// Implements the capability `usage-limit-retry` in the workflows: the final step of the go workflow returns the issue to the queue
// at a usage limit, and the queue dispatches builds apart. The step is run for real, with a fake `gh` that records what it is asked.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retryMarker } from '../scripts/lib/limit-retry.mjs';

const root = new URL('../', import.meta.url).pathname;
const go = readFileSync(`${root}templates/workflows/relevo-go.yml`, 'utf8');
const queue = readFileSync(`${root}templates/workflows/relevo-queue.yml`, 'utf8');
const hasJq = spawnSync('jq', ['--version']).status === 0;

/** The shell of the `run:` of the step with the given id. */
function stepScript(text, id) {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => l.trim() === `id: ${id}`);
  const run = lines.findIndex((l, i) => i > at && /^\s+run: \|$/.test(l));
  const out = [];
  for (let i = run + 1; i < lines.length && (lines[i].trim() === '' || /^ {10}/.test(lines[i])); i += 1) out.push(lines[i].slice(10));
  return out.join('\n');
}

test('the final step asks limit-retry before it marks qa-failed, and the retry path never adds qa-failed', () => {
  const script = stepScript(go, 'no_outcome');
  assert.match(script, /limit-retry\.mjs --file "\$EXECUTION_FILE" --rescue-state "\$RESCUE_STATE" --repo "\$GITHUB_REPOSITORY" --issue "\$ISSUE"/);
  const retryEdit = script.indexOf('--add-label relevo:queued');
  const failedEdit = script.indexOf('--add-label relevo:qa-failed');
  assert.ok(retryEdit > 0 && failedEdit > retryEdit, 'the retry path comes first');
  const retryBlock = script.slice(script.lastIndexOf('if [ -n "$retry_body" ]', retryEdit), failedEdit);
  assert.doesNotMatch(retryBlock, /qa-failed/);
  assert.match(retryBlock, /exit 0/);
  assert.match(go, /scripts\/usage-limit\.mjs scripts\/limit-retry\.mjs scripts\/run-cut\.mjs/, 'the package install checks for the script');
});

test('the queue sleeps the staggered seconds between two dispatches and not before the first', () => {
  assert.match(queue, /stagger=\$\(echo "\$result" \| node -e '.*stagger_seconds/);
  assert.match(queue, /if \[ "\$first" = "false" \] && \[ "\$stagger" -gt 0 \]; then sleep "\$stagger"; fi/);
  assert.ok(queue.indexOf('sleep "$stagger"') < queue.indexOf('gh workflow run relevo-go.yml'));
});

// A working folder where the step can run: the package scripts, a relevo.yml, and a `gh` that answers and records.
function world({ comments = [], language = 'en', labels = 'relevo:building' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'limit-step-'));
  mkdirSync(join(dir, 'bin'));
  symlinkSync(root.replace(/\/$/, ''), join(dir, '.relevo-plugin'));
  // The template of relevo.yml with the language chosen: a file that does not validate is not read, and the comment would be English.
  writeFileSync(join(dir, 'relevo.yml'), readFileSync(`${root}templates/relevo.yml`, 'utf8').replace(/^language:.*$/m, `language: ${language}`));
  writeFileSync(join(dir, 'comments.json'), JSON.stringify([comments]));
  // The labels of the issue are kept in a file, and `issue edit` applies them the way GitHub does: every addition of the command first, then
  // every removal. A label that one command both adds and removes is therefore gone afterwards.
  writeFileSync(join(dir, 'labels.txt'), `${labels.split(',').filter(Boolean).join('\n')}\n`);
  writeFileSync(join(dir, 'bin', 'gh'), `#!/bin/bash
echo "$@" >> "${dir}/gh.log"
if [ "$1 $2" = "issue edit" ]; then
  shift 3
  adds=(); removes=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --add-label) adds+=("$2"); shift 2 ;;
      --remove-label) removes+=("$2"); shift 2 ;;
      *) shift ;;
    esac
  done
  for l in "\${adds[@]}"; do grep -qxF "$l" "${dir}/labels.txt" || echo "$l" >> "${dir}/labels.txt"; done
  for l in "\${removes[@]}"; do grep -vxF "$l" "${dir}/labels.txt" > "${dir}/labels.tmp"; mv "${dir}/labels.tmp" "${dir}/labels.txt"; done
  exit 0
fi
case "$*" in
  "issue view"*"--json labels"*) cat "${dir}/labels.txt" ;;
  "issue view"*"--json assignees"*) echo "ana" ;;
  "api --paginate --slurp"*) cat "${dir}/comments.json" ;;
  "issue comment"*) printf '%s' "$5" > "${dir}/comment.txt" ;;
esac
exit 0
`);
  chmodSync(join(dir, 'bin', 'gh'), 0o755);
  return dir;
}
const future = Math.floor(Date.now() / 1000) + 3 * 3600;
const limitLog = (dir, resetsAt) => {
  const file = join(dir, 'log.json');
  writeFileSync(file, JSON.stringify([{ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour', ...(resetsAt ? { resetsAt } : {}) } }, { type: 'result', is_error: true, result: 'usage limit reached' }]));
  return file;
};
function runStep(dir, { log, rescue = 'nothing', branch = '', script = stepScript(go, 'no_outcome') }) {
  const env = { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, ISSUE: '7', JOB_STATUS: 'failure', RUN_URL: 'https://example.test/run/1', EXECUTION_FILE: log, RESCUE_STATE: rescue, RESCUE_BRANCH: branch, RESCUE_DETAIL: '', GITHUB_REPOSITORY: 'acme/app', GITHUB_OUTPUT: join(dir, 'out.txt'), RUNNER_TEMP: join(dir, 'tmp') };
  const r = spawnSync('bash', ['-e', '-c', script], { cwd: dir, env, encoding: 'utf8' });
  const read = (f) => { try { return readFileSync(join(dir, f), 'utf8'); } catch { return ''; } };
  return { status: r.status, stderr: r.stderr, gh: read('gh.log'), comment: read('comment.txt'), out: read('out.txt'), labels: read('labels.txt').split('\n').filter(Boolean).sort() };
}
const botComment = (attempt, minutesAgo = 20) => ({ user: { type: 'Bot' }, created_at: new Date(Date.now() - minutesAgo * 60000).toISOString(), body: `x\n${retryMarker({ at: Date.now(), attempt, reason: 'backoff' })}` });

test('Scenario: The log names the reset - the issue is queued, not qa-failed, and the comment says when', { skip: !hasJq && 'jq is not installed' }, () => {
  const dir = world();
  const r = runStep(dir, { log: limitLog(dir, future) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.gh, /issue edit 7 .*--add-label relevo:queued/);
  assert.doesNotMatch(r.gh, /qa-failed/);
  assert.match(r.comment, /^@ana The run stopped because the usage limit/);
  assert.match(r.comment, new RegExp(new Date(future * 1000 + 60000).toISOString().slice(0, 16).replace('T', ' ')));
  assert.match(r.comment, /retry 1 of 3/);
  assert.match(r.out, /reported=true/);
});

test('Scenario: The log does not name the reset - a back-off, said to be a guess; Spanish when the repository says so', { skip: !hasJq && 'jq is not installed' }, () => {
  const dir = world({ language: 'es' });
  const r = runStep(dir, { log: limitLog(dir) });
  assert.match(r.gh, /--add-label relevo:queued/);
  assert.match(r.comment, /no dice cuándo se restablece la cuota/);
  assert.match(r.comment, /reintento 1 de 3/);
});

test('Scenario: Work was kept - the comment names the branch and the issue is queued', { skip: !hasJq && 'jq is not installed' }, () => {
  const dir = world();
  const r = runStep(dir, { log: limitLog(dir, future), rescue: 'kept', branch: 'feature/7-x' });
  assert.match(r.gh, /--add-label relevo:queued/);
  assert.match(r.comment, /on the branch `feature\/7-x` and the retry continues from it/);
});

test('Scenario: Work could not be kept - qa-failed and the comment says so', { skip: !hasJq && 'jq is not installed' }, () => {
  const dir = world();
  const r = runStep(dir, { log: limitLog(dir, future), rescue: 'unsafe' });
  assert.match(r.gh, /--add-label relevo:qa-failed/);
  assert.doesNotMatch(r.gh, /--add-label relevo:queued/);
  assert.match(r.comment, /usage limit/);
});

test('Scenario: The limit is hit again and again - the fourth stop is qa-failed and asks a person', { skip: !hasJq && 'jq is not installed' }, () => {
  const dir = world({ comments: [botComment(1, 300), botComment(2, 200), botComment(3, 20)] });
  const r = runStep(dir, { log: limitLog(dir, future) });
  assert.match(r.gh, /--add-label relevo:qa-failed/);
  assert.doesNotMatch(r.gh, /--add-label relevo:queued/);
  assert.match(r.comment, /after 3 automatic retries/);
});

test('Scenario: Another failure - a log without a limit keeps the generic comment and qa-failed', { skip: !hasJq && 'jq is not installed' }, () => {
  const dir = world();
  const file = join(dir, 'plain.json');
  writeFileSync(file, JSON.stringify([{ type: 'result', is_error: true, result: 'the shell failed' }]));
  const r = runStep(dir, { log: file });
  assert.match(r.gh, /--add-label relevo:qa-failed/);
  assert.match(r.comment, /ended without a result/);
});

// A requirement of `usage-limit-retry`: an issue returned to the queue ends with the queued label and no other lifecycle label.
test('Scenario: The issue was building - it ends with queued and none of ready, building or qa-failed', { skip: !hasJq && 'jq is not installed' }, () => {
  const dir = world({ labels: 'relevo:building' });
  const r = runStep(dir, { log: limitLog(dir, future) });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.labels, ['relevo:queued']);
});

test('Scenario: The issue was ready or already queued - it still ends with queued only', { skip: !hasJq && 'jq is not installed' }, () => {
  for (const before of ['relevo:ready', 'relevo:queued', 'relevo:ready,relevo:building']) {
    const dir = world({ labels: before });
    const r = runStep(dir, { log: limitLog(dir, future) });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.labels, ['relevo:queued'], `from ${before}`);
  }
});

test('Scenario: The labels were renamed - the renamed queued label is what the issue ends with', { skip: !hasJq && 'jq is not installed' }, () => {
  // What the template asks of a repository that renamed its labels: change the names of the step (the plain names and the ones inside a
  // pattern such as `relevo:(ready|building)`) to the renamed ones.
  const renamed = stepScript(go, 'no_outcome')
    .replace(/relevo:\(/g, 'team:(')
    .replace(/relevo:(ready|queued|building|qa-failed|needs-spec)\b/g, 'team:$1');
  assert.doesNotMatch(renamed, /relevo:(ready|queued|building|qa-failed|needs-spec)\b/);
  const dir = world({ labels: 'team:building,bug' });
  const r = runStep(dir, { log: limitLog(dir, future), script: renamed });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.labels, ['bug', 'team:queued']);
});

test('Scenario: A label is never added and removed by one edit - no template does it', () => {
  const dirTemplates = `${root}templates/workflows/`;
  const found = [];
  for (const file of readdirSync(dirTemplates).filter((f) => f.endsWith('.yml'))) {
    readFileSync(`${dirTemplates}${file}`, 'utf8').split('\n').forEach((line, i) => {
      if (!/\bgh issue edit\b/.test(line)) return;
      const added = [...line.matchAll(/--add-label\s+(\S+)/g)].map((m) => m[1]);
      const removed = new Set([...line.matchAll(/--remove-label\s+(\S+)/g)].map((m) => m[1]));
      added.filter((l) => removed.has(l)).forEach((l) => found.push(`${file}:${i + 1} adds and removes ${l}`));
    });
  }
  assert.deepEqual(found, []);
});
