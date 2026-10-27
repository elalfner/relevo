import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ownedByQueue, startable, toDispatch } from '../scripts/lib/requeue.mjs';
import { resolveLabelNames } from '../scripts/lib/labels.mjs';
import { planGo } from '../scripts/lib/plan.mjs';
import { loadConfig } from '../scripts/lib/config.mjs';

const root = new URL('../', import.meta.url).pathname;
const template = readFileSync(`${root}templates/relevo.yml`, 'utf8');
const { config } = loadConfig(template.replace('[]          # GitHub', '[ana]       # GitHub'));
const BODY = '#### Scenario: A\n- **WHEN** x\n- **THEN** y\n\nEdge cases:\n- none\n';
const issue = (n, labels, extra = {}) => ({
  number: n, title: `t${n}`, body: BODY, state: 'open', labels, assignees: ['ana'],
  milestone: { number: 1, due_on: null }, ready_at: `2026-01-0${n}T00:00:00Z`, ready_by: 'luz', ...extra,
});

test('Scenario: Capacity frees up - the oldest queued issue starts once the assignee has room', () => {
  const full = planGo({ config, issues: [issue(1, ['relevo:queued']), issue(2, ['relevo:built']), issue(3, ['relevo:built'])], permissions: { luz: 'write' } });
  assert.deepEqual(startable(full.decisions), []);
  const freed = planGo({ config, issues: [issue(1, ['relevo:queued']), issue(2, ['relevo:in-review']), issue(3, ['relevo:built'])], permissions: { luz: 'write' } });
  assert.deepEqual(startable(freed.decisions), [1]);
});

test('dispatch never exceeds the free agent slots', () => {
  const decisions = [{ action: 'start', issue: 4 }, { action: 'queue', issue: 5 }, { action: 'start', issue: 6 }];
  assert.deepEqual(toDispatch(decisions, { alreadyRunning: 2, limit: 3 }), [4]);
  assert.deepEqual(toDispatch(decisions, { alreadyRunning: 3, limit: 3 }), []);
});

test('the script prints the issues to start from a state file and writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'requeue-'));
  writeFileSync(join(dir, 'relevo.yml'), template.replace('[]          # GitHub', '[ana]       # GitHub'));
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ issues: [issue(1, ['relevo:queued'])], completed: [], running: [], permissions: {} }));
  const r = spawnSync('node', [`${root}scripts/requeue.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).start, [1]);
});

test('the queue workflow runs on events and on a schedule, one evaluation at a time, and dispatches go', () => {
  const wf = readFileSync(`${root}templates/workflows/relevo-queue.yml`, 'utf8');
  assert.match(wf, /types: \[closed, labeled, unlabeled\]/);
  assert.match(wf, /schedule:/);
  assert.match(wf, /group: relevo-queue/);
  assert.match(wf, /cancel-in-progress: false/);
  assert.match(wf, /gh workflow run relevo-go\.yml/);
  assert.doesNotMatch(wf, /pull_request_target/);
  assert.match(readFileSync(`${root}templates/workflows/relevo-go.yml`, 'utf8'), /workflow_dispatch:/);
});

// ---------- the queue acts only on waiting issues

const names = resolveLabelNames({});

test('Scenario: Issue just marked ready - the queue leaves it to the go run its label started', () => {
  const issues = [issue(1, ['relevo:ready'], { assignees: [] }), issue(2, ['relevo:queued']), issue(3, ['relevo:blocked'], { body: `${BODY}\nDepends-on: #99\n` })];
  const { decisions } = planGo({ config, issues, permissions: { luz: 'write' } });
  assert.ok(decisions.some((d) => d.issue === 1), 'the planner still plans the ready issue, so the limits stay right');
  const mine = ownedByQueue(decisions, issues, names);
  assert.deepEqual(mine.map((d) => d.issue).sort(), [2, 3]);
  assert.ok(!mine.some((d) => d.comment && d.issue === 1), 'no comment for the ready issue from the queue');
});

test('a ready issue that would start is not dispatched by the queue (its own go run starts it)', () => {
  const complete = '## Scenarios\n- **WHEN** a\n- **THEN** b\n\n## Edge cases\n- c\n';
  const issues = [issue(1, ['relevo:ready'], { body: complete }), issue(2, ['relevo:queued'])];
  const { decisions } = planGo({ config, issues, permissions: { luz: 'write' } });
  assert.deepEqual(startable(decisions).sort(), [1, 2]);
  assert.deepEqual(startable(ownedByQueue(decisions, issues, names)), [2]);
});

test('Scenario: Waiting issue becomes eligible - the queue still starts it', () => {
  const issues = [issue(5, ['relevo:blocked'], { body: `${BODY}\nDepends-on: #1\n` })];
  const { decisions } = planGo({ config, issues, completed: [1], permissions: { luz: 'write' } });
  assert.deepEqual(startable(ownedByQueue(decisions, issues, names)), [5]);
});

test('the script ignores a ready issue even when it would start', () => {
  const dir = mkdtempSync(join(tmpdir(), 'requeue-own-'));
  writeFileSync(join(dir, 'relevo.yml'), template.replace('[]          # GitHub', '[ana]       # GitHub'));
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ issues: [issue(1, ['relevo:ready'], { body: '## Scenarios\n- **WHEN** a\n- **THEN** b\n\n## Edge cases\n- c\n' }), issue(2, ['relevo:queued'], { assignees: ['ana'], ready_at: '2026-01-02T00:00:00Z' })], completed: [], running: [], permissions: { luz: 'write' } }));
  const r = spawnSync('node', [`${root}scripts/requeue.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.start, [2]);
  assert.equal(out.summary.start, 1);
});

test('Scenario: Urgent label added to a queued issue - the queue starts it over the assignee capacity, and only with a valid label', () => {
  const fullFor = (urgent) => [
    issue(1, urgent ? ['relevo:queued', 'relevo:urgent'] : ['relevo:queued'], urgent ? { urgent_by: urgent } : {}),
    issue(2, ['relevo:built']), issue(3, ['relevo:built']),
  ];
  const permissions = { luz: 'write', marta: 'read' };
  const startsFor = (issues) => startable(ownedByQueue(planGo({ config, issues, permissions }).decisions, issues, names));
  assert.deepEqual(startsFor(fullFor(null)), [], 'without the label it waits for capacity');
  assert.deepEqual(startsFor(fullFor('luz')), [1], 'a valid label starts it');
  assert.deepEqual(startsFor(fullFor('marta')), [], 'a label from someone without permission starts nothing');
});

test('the script starts an urgent queued issue over capacity, removes nothing else and prints it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'requeue-urgent-'));
  writeFileSync(join(dir, 'relevo.yml'), template.replace('[]          # GitHub', '[ana]       # GitHub'));
  const run = (urgentBy) => {
    const issues = [issue(1, ['relevo:queued', 'relevo:urgent'], { urgent_by: urgentBy }), issue(2, ['relevo:built']), issue(3, ['relevo:built'])];
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ issues, completed: [], running: [], permissions: { luz: 'write', marta: 'read' } }));
    const r = spawnSync('node', [`${root}scripts/requeue.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const valid = run('luz');
  assert.deepEqual(valid.start, [1]);
  assert.equal(valid.summary.start, 1);
  const denied = run('marta');
  assert.deepEqual(denied.start, []);
  assert.equal(denied.summary.queue, 1);
});

test('Scenario: Dependency finishes in the other repository - the scheduled run starts the blocked issue once the state says it is completed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'requeue-links-'));
  writeFileSync(join(dir, 'relevo.yml'), template.replace('[]          # GitHub', '[ana]       # GitHub').replace('links: []', 'links: [acme/api]'));
  const run = (state) => {
    writeFileSync(join(dir, 'state.json'), JSON.stringify({ issues: [issue(1, ['relevo:blocked'], { body: `${BODY}\nDepends-on: acme/api#12\n` })], completed: [], running: [], permissions: { luz: 'write' }, ...state }));
    const r = spawnSync('node', [`${root}scripts/requeue.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  assert.deepEqual(run({}).start, [], 'still waiting');
  assert.deepEqual(run({ completedExternal: ['acme/api#12'] }).start, [1], 'the other repository finished');
});

test('Scenario: No credential - the queue dispatches nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'requeue-nocred-'));
  writeFileSync(join(dir, 'relevo.yml'), template.replace('[]          # GitHub', '[ana]       # GitHub'));
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ issues: [issue(1, ['relevo:queued'])], completed: [], running: [], permissions: {} }));
  const run = (...extra) => JSON.parse(spawnSync('node', [`${root}scripts/requeue.mjs`, '--config', join(dir, 'relevo.yml'), '--input', join(dir, 'state.json'), ...extra], { encoding: 'utf8' }).stdout);
  assert.deepEqual(run().start, [1]);
  assert.deepEqual(run('--credential', 'false').start, []);
  assert.deepEqual(run('--credential', 'true').start, [1]);
});
