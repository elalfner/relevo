import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSnapshot, readSnapshot, writeBuildStart, writeBuildEnd, writeSnapshot, writeTotals } from '../scripts/lib/build-state.mjs';
import { recordCheckpointed, recordGroups } from '../scripts/lib/group-progress.mjs';
import { recordLens, recordPhase, writeClass } from '../scripts/lib/phase-log.mjs';
import { recordAgent } from '../scripts/lib/run-budget.mjs';

const make = () => {
  const root = mkdtempSync(join(tmpdir(), 'relevo-bs-'));
  const dir = join(root, 'state');
  const worktree = join(root, 'wt');
  mkdirSync(dir);
  mkdirSync(join(worktree, 'openspec', 'changes', '42-x'), { recursive: true });
  return { root, dir, worktree };
};
const tasks = (worktree, text) => writeFileSync(join(worktree, 'openspec', 'changes', '42-x', 'tasks.md'), text);
const git = () => '';
const T0 = Date.parse('2026-11-17T10:00:00Z');

test('the snapshot holds the phase, the group, the tasks, the start and the last change', () => {
  const { dir, worktree } = make();
  writeBuildStart(dir, { issue: 42, changeId: '42-x', now: T0 });
  recordPhase(dir, { phase: 'development' }, T0 + 60000);
  writeFileSync(join(dir, 'phase.json'), JSON.stringify({ phase: 'development' }));
  recordGroups(dir, 3);
  recordCheckpointed(dir, 1, 3);
  tasks(worktree, '- [x] 1.1 a\n- [ ] 1.2 b\n');
  const when = new Date(T0 + 5 * 60000);
  for (const f of ['phase.json', 'groups.json', 'build.json', 'phases.jsonl']) utimesSync(join(dir, f), when, when);
  const s = buildSnapshot({ dir, worktree, git, now: T0 + 6 * 60000 });
  assert.deepEqual(s.phase, { phase: 'development', attempt: null, of: null });
  assert.deepEqual(s.group, { group: 2, of: 3 });
  assert.deepEqual(s.tasks, { done: 1, total: 2 });
  assert.equal(s.startedAt, T0);
  assert.equal(s.lastChange, T0 + 5 * 60000);
  assert.equal(s.minutes, 6);
  assert.equal(s.ended, null);
  assert.equal(s.outcome, null);
  assert.equal(s.totals, null);
});

test('the lens and the agent records, the outcome and the totals are in it when present', () => {
  const { dir, worktree } = make();
  writeBuildStart(dir, { issue: 42, changeId: '42-x', now: T0 });
  recordLens(dir, { lens: 'code' }, T0 + 1000);
  recordLens(dir, { lens: 'code', end: true }, T0 + 2000);
  recordAgent(dir, { agent: 'relevo:dev', toolUses: 4 }, T0 + 3000);
  writeClass(dir, 'built');
  writeTotals(dir, { turns: 18, cost: 1.5, tokens: 1000 });
  writeBuildEnd(dir, { status: 0, now: T0 + 9000 });
  const s = buildSnapshot({ dir, worktree, git, now: T0 + 10000 });
  assert.equal(s.lenses.length, 2);
  assert.equal(s.agents.length, 1);
  assert.equal(s.agents[0].agent, 'relevo:dev');
  assert.equal(s.outcome, 'built');
  assert.deepEqual(s.totals, { turns: 18, cost: 1.5, tokens: 1000 });
  assert.deepEqual(s.ended, { status: 0, at: T0 + 9000 });
});

test('without an announcement the phase is the one the tree shows', () => {
  const { dir, worktree } = make();
  writeBuildStart(dir, { issue: 42, changeId: '42-x', now: T0 });
  tasks(worktree, '- [ ] 1.1 a\n');
  assert.equal(buildSnapshot({ dir, worktree, git, now: T0 }).phase.phase, 'development');
});

test('Scenario: the worktree is gone - the tasks are those of the last snapshot written', () => {
  const { dir, worktree, root } = make();
  writeBuildStart(dir, { issue: 42, changeId: '42-x', now: T0 });
  tasks(worktree, '- [x] 1.1 a\n- [x] 1.2 b\n');
  const live = buildSnapshot({ dir, worktree, git, now: T0 + 1000 });
  writeSnapshot(dir, live);
  const gone = buildSnapshot({ dir, worktree: join(root, 'removed'), git, now: T0 + 2000 });
  assert.deepEqual(gone.tasks, { done: 2, total: 2 });
  assert.deepEqual(readSnapshot(dir).tasks, { done: 2, total: 2 });
});

test('an issue with no folder has no snapshot, and nothing throws', () => {
  assert.equal(buildSnapshot({ dir: join(tmpdir(), 'relevo-no-such-state'), worktree: '/nope', git, now: T0 }), null);
  assert.equal(buildSnapshot({ dir: null, worktree: null, git, now: T0 }), null);
  assert.equal(readSnapshot(join(tmpdir(), 'relevo-no-such-state')), null);
  const { dir } = make();
  writeFileSync(join(dir, 'build.json'), 'not json');
  assert.ok(buildSnapshot({ dir, worktree: '/nope', git, now: T0 }));
});
