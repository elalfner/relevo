import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupInProgress, readGroups, recordCheckpointed, recordGroups } from '../scripts/lib/group-progress.mjs';
import { renderProgress } from '../scripts/lib/progress.mjs';

const GROUPS = fileURLToPath(new URL('../scripts/task-groups.mjs', import.meta.url));
const tmp = () => mkdtempSync(join(tmpdir(), 'relevo-groups-'));
const TASKS = '## 1. A\n\n- [ ] 1.1 a\n- [ ] 1.2 b\n\n## 2. B\n\n- [ ] 2.1 c\n- [ ] 2.2 d\n';

test('the number of groups and the group committed are recorded and read back', () => {
  const dir = tmp();
  assert.equal(readGroups(dir), null);
  assert.equal(recordGroups(dir, 3), true);
  assert.deepEqual(readGroups(dir), { of: 3, done: 0 });
  assert.equal(recordCheckpointed(dir, 1, 3), true);
  assert.deepEqual(readGroups(dir), { of: 3, done: 1 });
  assert.equal(readGroups(null), null);
});

test('Scenario: Second group of three / One group - the group in progress is the last committed plus one, capped at the total', () => {
  assert.deepEqual(groupInProgress({ of: 3, done: 1 }), { group: 2, of: 3 });
  assert.deepEqual(groupInProgress({ of: 1, done: 0 }), { group: 1, of: 1 });
  assert.deepEqual(groupInProgress({ of: 3, done: 3 }), { group: 3, of: 3 });
  assert.equal(groupInProgress(null), null);
});

test('Scenario: A resumed run - the groups of this run are counted again from 1', () => {
  const dir = tmp();
  recordGroups(dir, 3);
  recordCheckpointed(dir, 3, 3);
  recordGroups(dir, 2);
  assert.deepEqual(groupInProgress(readGroups(dir)), { group: 1, of: 2 });
});

test('the numbers that cannot be recorded or read are never an error', () => {
  assert.equal(recordGroups('/nonexistent/x/y', 2), false);
  assert.equal(recordCheckpointed('/nonexistent/x/y', 1, 2), false);
  assert.equal(recordGroups(null, 2), false);
  const dir = tmp();
  writeFileSync(join(dir, 'groups.json'), 'not json');
  assert.equal(readGroups(dir), null);
  writeFileSync(join(dir, 'groups.json'), JSON.stringify({ of: 0, done: 'x' }));
  assert.equal(readGroups(dir), null);
});

test('the progress text shows "group 2 of 3" after the first checkpoint of three, "group 1 of 1" for one group and none when nothing was recorded', () => {
  assert.match(renderProgress({ phase: 'development', tasks: { done: 2, total: 6 }, minutes: 4, group: { group: 2, of: 3 } }), /^Relevo build in progress: development\nTasks: 2 of 6\nGroup 2 of 3\nRunning for 4 min/);
  assert.match(renderProgress({ phase: 'development', minutes: 1, group: { group: 1, of: 1 } }), /Group 1 of 1/);
  assert.doesNotMatch(renderProgress({ phase: 'development', minutes: 1 }), /roup/);
  assert.match(renderProgress({ phase: 'development', minutes: 1, group: { group: 2, of: 3 }, language: 'es' }), /Grupo 2 de 3/);
  assert.doesNotMatch(renderProgress({ phase: 'qa', minutes: 1, group: { group: 3, of: 3 } }), /roup/, 'the group is shown while the phase is development');
});

test('task-groups.mjs records the number of groups when there is a progress folder, and prints the same without one', () => {
  const root = tmp();
  const file = join(root, 'tasks.md');
  writeFileSync(file, TASKS);
  const dir = join(root, 'progress');
  mkdirSync(dir);
  const withDir = spawnSync(process.execPath, [GROUPS, file], { encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: dir } });
  const without = spawnSync(process.execPath, [GROUPS, file], { encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: '' }, cwd: root });
  assert.equal(withDir.status, 0);
  assert.equal(withDir.stdout, without.stdout);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'groups.json'), 'utf8')), { of: 2, done: 0 });
});

test('task-groups.mjs does not fail or change its output when the folder cannot be written', () => {
  const root = tmp();
  const file = join(root, 'tasks.md');
  writeFileSync(file, TASKS);
  const r = spawnSync(process.execPath, [GROUPS, file], { encoding: 'utf8', env: { ...process.env, RELEVO_PROGRESS_DIR: join(root, 'missing', 'deep') } });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).groups.length, 2);
});
