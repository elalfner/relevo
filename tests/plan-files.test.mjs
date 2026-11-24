import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { filesBackend } from '../scripts/lib/tracker/files.mjs';
import { applyFiles, planFiles } from '../scripts/lib/plan-files.mjs';

const YML = 'limits:\n  run_max_cost: 5\ntracker: files\ngit_provider: local\nplatforms:\n  app:\n    stack: flutter\n';
const BODY = '## Summary\n\nA counter.\n\n## Scenarios\n\n- **WHEN** the user taps\n- **THEN** the counter goes up\n\n## Edge cases\n\n- at 99: shows 100\n\n## Out of scope\n\n- saving it\n';
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function project() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-plan-')));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  writeFileSync(join(dir, 'relevo.yml'), YML);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  const { config } = loadConfig(YML);
  return { dir, config, tracker: filesBackend({ repoRoot: dir }) };
}
const issue = (p, title = 'Counter', body = BODY, ready = true) => {
  p.tracker.issueCreate({ title, body });
  const n = p.tracker.issueList({ state: 'all' }).length;
  if (ready) p.tracker.stateSet(n, { add: ['relevo:ready'] });
  return n;
};
const one = (p, n, extra = {}) => planFiles({ config: p.config, tracker: p.tracker, only: n, ...extra }).decisions[0];

test('Scenario: Build without an assignee - a ready issue with no assignee or milestone starts', () => {
  const p = project();
  const n = issue(p);
  const d = one(p, n);
  assert.equal(d.action, 'start');
  assert.deepEqual(d.labels, { add: ['relevo:building', 'relevo:local'], remove: ['relevo:ready', 'relevo:queued', 'relevo:build-failed'] });
  assert.equal(d.branch, 'feature/1-counter');
  assert.equal(d.change_id, '1-counter');
  assert.equal(d.base, 'dev');
  assert.equal(d.platform, 'app');
  assert.equal(d.stack, 'flutter');
  assert.match(d.issue_hash, /^[0-9a-f]{64}$/);
  rmSync(p.dir, { recursive: true });
});

test('an issue that is not approved, was edited after ready, or is closed does not start', () => {
  const p = project();
  const a = issue(p, 'A', BODY, false);
  assert.match(one(p, a).reason, /not approved/);
  const b = issue(p, 'B');
  p.tracker.issueEditBody(b, `${BODY}\n- extra\n`);
  assert.match(one(p, b).reason, /issue changed after ready/);
  const c = issue(p, 'C');
  p.tracker.issueClose(c);
  assert.equal(one(p, c).reason, 'the issue is closed');
  assert.match(one(p, 99).reason, /there is no issue 99/);
  rmSync(p.dir, { recursive: true });
});

test('an incomplete issue goes back to needs-spec with what is missing', () => {
  const p = project();
  const n = issue(p, 'Bad', '## Scenarios\n\n- **WHEN** x\n');
  const d = one(p, n);
  assert.equal(d.action, 'needs-spec');
  assert.ok(d.missing.length > 0);
  assert.deepEqual(d.labels.add, ['relevo:needs-spec']);
  rmSync(p.dir, { recursive: true });
});

test('Scenario: dependency not shipped - the issue waits and names the other one; shipped, it starts', () => {
  const p = project();
  const first = issue(p, 'First');
  const second = issue(p, 'Second', `${BODY}\nDepends-on: #${first}\n`);
  const waiting = one(p, second);
  assert.equal(waiting.action, 'skip');
  assert.match(waiting.reason, /waiting for #1/);
  p.tracker.issueClose(first);
  assert.equal(one(p, second).action, 'start');
  const external = issue(p, 'Third', `${BODY}\nDepends-on: owner/repo#2\n`);
  assert.equal(one(p, external).action, 'needs-spec');
  rmSync(p.dir, { recursive: true });
});

test('the claim moves the issue to building and a second plan sees it', () => {
  const p = project();
  const n = issue(p);
  const result = planFiles({ config: p.config, tracker: p.tracker, only: n });
  assert.equal(applyFiles(result.decisions, { tracker: p.tracker }), 0, 'a start is not applied without the claim');
  assert.equal(applyFiles(result.decisions, { tracker: p.tracker, includeStart: true }), 1);
  assert.deepEqual(p.tracker.issueGet(n).labels.map((l) => l.name).sort(), ['relevo:building', 'relevo:local']);
  assert.match(one(p, n).reason, /already being built/);
  rmSync(p.dir, { recursive: true });
});

test('a failed build is retried only with --retry and when it left no branch', () => {
  const p = project();
  const n = issue(p);
  p.tracker.stateSet(n, { add: ['relevo:build-failed'], remove: ['relevo:ready'] });
  assert.match(one(p, n).reason, /--retry/);
  assert.equal(one(p, n, { retry: true }).action, 'start');
  assert.match(one(p, n, { retry: true, hasBranch: () => true }).reason, /fix/);
  rmSync(p.dir, { recursive: true });
});

test('go-plan.mjs on a files project plans and claims with no repo, no gh and no network', () => {
  const p = project();
  const n = issue(p);
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [new URL('../scripts/go-plan.mjs', import.meta.url).pathname, '--place', 'local', '--only', String(n), ...args], {
    cwd: p.dir, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin', GH_TOKEN: '', GITHUB_REPOSITORY: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const planned = run();
  assert.equal(planned.decisions[0].action, 'start');
  const claimed = run('--claim');
  assert.equal(claimed.applied, 1);
  assert.equal(run().decisions[0].action, 'skip');
  assert.throws(() => execFileSync(process.execPath, [new URL('../scripts/go-plan.mjs', import.meta.url).pathname, '--only', String(n)], { cwd: p.dir, stdio: 'pipe' }), /only on this machine/);
  rmSync(p.dir, { recursive: true });
});
