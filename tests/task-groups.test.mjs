import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { taskGroups } from '../scripts/lib/task-groups.mjs';

const CLI = fileURLToPath(new URL('../scripts/task-groups.mjs', import.meta.url));

const THREE_SECTIONS = `# Tasks

## 1. Configuration

- [x] 1.1 done already
- [ ] 1.2 add the setting
- [ ] 1.3 add the template

## 2. Guard

- [ ] 2.1 write the library
- [ ] 2.2 write the command

## 3. Docs

- [ ] 3.1 update the docs

## Workflow follow-up

- Commit on the branch.
`;

test('Scenario: A change with three sections - one group per section, in file order, with only the pending tasks', () => {
  const { groups, pending } = taskGroups(THREE_SECTIONS);
  assert.equal(pending, 5);
  assert.deepEqual(groups.map((g) => [g.section, g.title, g.tasks]), [
    ['1', 'Configuration', ['1.2', '1.3']],
    ['2', 'Guard', ['2.1', '2.2']],
    ['3', 'Docs', ['3.1']],
  ]);
});

test('Scenario: A small change - three tasks or fewer are one group', () => {
  const small = '## 1. A\n\n- [ ] 1.1 a\n\n## 2. B\n\n- [ ] 2.1 b\n- [x] 2.2 done\n\n## 3. C\n\n- [ ] 3.1 c\n';
  const { groups, pending } = taskGroups(small);
  assert.equal(pending, 3);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].tasks, ['1.1', '2.1', '3.1']);
  // Four pending tasks in two sections are two groups.
  assert.equal(taskGroups('## 1. A\n- [ ] 1.1 a\n- [ ] 1.2 a\n## 2. B\n- [ ] 2.1 b\n- [ ] 2.2 b\n').groups.length, 2);
});

test('a section with every task done has no group, and a change with nothing pending has none at all', () => {
  const done = '## 1. A\n- [x] 1.1 a\n## 2. B\n- [ ] 2.1 b\n- [ ] 2.2 b\n- [ ] 2.3 b\n- [ ] 2.4 b\n';
  assert.deepEqual(taskGroups(done).groups.map((g) => g.section), ['2']);
  assert.deepEqual(taskGroups('## 1. A\n- [x] 1.1 a\n'), { groups: [], pending: 0 });
  assert.deepEqual(taskGroups(''), { groups: [], pending: 0 });
  assert.deepEqual(taskGroups(undefined), { groups: [], pending: 0 });
});

test('a task under no section goes in a group of its own at the end', () => {
  const text = '- [ ] 0.1 loose\n- [ ] 0.2 loose\n## 1. A\n- [ ] 1.1 a\n- [ ] 1.2 a\n';
  const { groups } = taskGroups(text);
  assert.deepEqual(groups.map((g) => [g.section, g.tasks]), [['1', ['1.1', '1.2']], [null, ['0.1', '0.2']]]);
});

test('the command prints the groups as JSON and exits 2 without a readable file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-groups-'));
  const file = join(dir, 'tasks.md');
  writeFileSync(file, THREE_SECTIONS);
  const ok = spawnSync(process.execPath, [CLI, file], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).groups.length, 3);
  assert.equal(spawnSync(process.execPath, [CLI], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [CLI, join(dir, 'missing.md')], { encoding: 'utf8' }).status, 2);
});
