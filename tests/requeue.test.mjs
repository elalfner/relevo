import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startable, toDispatch } from '../scripts/lib/requeue.mjs';
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
