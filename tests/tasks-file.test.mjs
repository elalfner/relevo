import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskLine, parseTaskLines, countTasks, uncheckedTasks, correctionSection } from '../scripts/lib/tasks-file.mjs';
import { doneTaskIds, taskGroups } from '../scripts/lib/task-groups.mjs';

// Spec: go, "The tasks are counted as OpenSpec counts them".

test('Scenario: A box with spacing - `- [ x]` is done and part of the total', () => {
  const task = parseTaskLine('- [ x] 1.1 padded');
  assert.equal(task.done, true);
  assert.equal(task.id, '1.1');
  assert.deepEqual(countTasks('- [ x] 1.1 padded\n- [ ] 1.2 open\n'), { done: 1, total: 2 });
});

test('upper-case X is done, and `[ x ]` too', () => {
  assert.equal(parseTaskLine('- [X] 1.1 a').done, true);
  assert.equal(parseTaskLine('- [ x ] 1.1 a').done, true);
});

test('Scenario: An unfinished marker - `[~]`, `[-]` and `[]` count in the total, are not done and are listed as open', () => {
  const text = '- [~] 1.1 a\n- [-] 1.2 b\n- [] 1.3 c\n- [x] 1.4 d\n';
  assert.deepEqual(countTasks(text), { done: 1, total: 4 });
  assert.deepEqual(uncheckedTasks(text), ['1.1', '1.2', '1.3']);
});

test('every list marker OpenSpec accepts is a task: `-`, `*`, `+`, `1.` and `1)`, indented or not', () => {
  const text = ['- [ ] 1.1 a', '* [ ] 1.2 b', '+ [x] 1.3 c', '1. [ ] 1.4 d', '2) [ ] 1.5 e', '  - [ ] 1.5.1 nested'].join('\n');
  assert.deepEqual(countTasks(text), { done: 1, total: 6 });
});

test('Scenario: A line with no box - a plain bullet, a link bullet and prose are not tasks', () => {
  const text = ['- plain bullet', '- [A](http://example.com) a link', '- [Some doc](./doc.md)', '- [ ](http://x) a link with a blank label', 'some prose [ ] in the middle', '- [ ] 1.1 the only task'].join('\n');
  assert.deepEqual(countTasks(text), { done: 0, total: 2 });
  assert.deepEqual(uncheckedTasks(text), ['1.1']);
});

test('a task with no N.M number counts but has no id', () => {
  const tasks = parseTaskLines('- [ ] write the docs\n- [ ] 2.3 with id\n');
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].id, null);
  assert.equal(tasks[1].id, '2.3');
  assert.deepEqual(uncheckedTasks('- [ ] write the docs\n- [ ] 2.3 with id\n'), ['2.3']);
});

test('the line number is 1-based and a CRLF file reads the same', () => {
  const tasks = parseTaskLines('# Tasks\r\n\r\n- [x] 1.1 a\r\n- [ ] 1.2 b\r\n');
  assert.deepEqual(tasks.map((t) => [t.line, t.done, t.id, t.text]), [[3, true, '1.1', '1.1 a'], [4, false, '1.2', '1.2 b']]);
});

test('every reader of Relevo reads the same boxes', () => {
  const text = ['# Tasks', '', '## 1. A', '', '- [x] 1.1 done', '* [~] 1.2 tilde', '+ [] 1.3 empty', '', '## 2. B', '', '1. [ ] 2.1 ordered', '- [ x] 2.2 padded'].join('\n');
  assert.deepEqual(countTasks(text), { done: 2, total: 5 });
  assert.deepEqual(uncheckedTasks(text), ['1.2', '1.3', '2.1']);
  assert.deepEqual(doneTaskIds(text), ['1.1', '2.2']);
  assert.deepEqual(taskGroups(text).groups.flatMap((g) => g.tasks).sort(), ['1.2', '1.3', '2.1']);
  assert.equal(taskGroups(text).pending, 3);
});

test('a correction section is read with the same rule', () => {
  const text = ['## 1. A', '- [x] 1.1 a', '', '## 2. Review corrections [Iteration 1]', '', '* [ ] 2.1 Test: first', '- [~] 2.2 second'].join('\n');
  assert.deepEqual(correctionSection(text), { found: true, ids: ['2.1', '2.2'], tasks: [{ id: '2.1', text: 'Test: first' }, { id: '2.2', text: 'second' }] });
});
