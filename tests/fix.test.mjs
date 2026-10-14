import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixOutcome } from '../scripts/lib/fix.mjs';
import { addCorrections, uncheckedTasks } from '../scripts/lib/tasks-file.mjs';
import { checkSpecFirst } from '../scripts/lib/fix-guard.mjs';
import { renderMessage } from '../scripts/lib/messages.mjs';

const CLI = (n) => new URL(`../scripts/${n}`, import.meta.url).pathname;

// ---------- State is preserved

test('Scenario: Fix after qa-failed - the issue becomes built and the assignee is notified', () => {
  const r = fixOutcome(['relevo:qa-failed', 'bug']);
  assert.deepEqual([r.allowed, r.from, r.to, r.notify], [true, 'qa-failed', 'built', 'assignee']);
  assert.deepEqual(r.labels, { add: ['relevo:built'], remove: ['relevo:qa-failed'] });
});

test('Scenario: Fix after requested changes - the issue returns to pr-open and the reviewer is re-requested', () => {
  const r = fixOutcome(['relevo:changes-requested']);
  assert.deepEqual([r.allowed, r.from, r.to, r.notify], [true, 'changes-requested', 'pr-open', 'reviewer']);
  assert.deepEqual(r.labels, { add: ['relevo:pr-open'], remove: ['relevo:changes-requested'] });
});

test('a fix during review keeps the issue in review, with no label change', () => {
  const r = fixOutcome(['relevo:in-review']);
  assert.deepEqual([r.to, r.notify], ['in-review', null]);
  assert.deepEqual(r.labels, { add: [], remove: [] });
  assert.deepEqual(fixOutcome(['relevo:built']).labels, { add: [], remove: [] });
  assert.deepEqual(fixOutcome(['relevo:pr-open']).labels, { add: [], remove: [] });
});

test('there is nothing to fix before a branch has work to correct', () => {
  ['relevo:ready', 'relevo:queued', 'relevo:building', 'relevo:blocked', 'relevo:needs-spec'].forEach((label) => {
    const r = fixOutcome([label]);
    assert.equal(r.allowed, false, label);
    assert.match(r.reason, /needs a branch with work to correct/);
  });
  assert.equal(fixOutcome(['bug']).allowed, false);
});

test('the needs-reviewer overlay does not hide the real state', () => {
  const r = fixOutcome(['relevo:changes-requested', 'relevo:needs-reviewer']);
  assert.equal(r.to, 'pr-open');
  assert.deepEqual(r.labels.remove, ['relevo:changes-requested']);
});

test('renamed labels are honoured', () => {
  const r = fixOutcome(['fallo-qa'], { 'qa-failed': 'fallo-qa', built: 'construido' });
  assert.deepEqual(r.labels, { add: ['construido'], remove: ['fallo-qa'] });
});

test('fix-state CLI: allowed states exit 0, others exit 1', () => {
  const ok = spawnSync('node', [CLI('fix-state.mjs'), '--current', 'relevo:qa-failed'], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).to, 'built');
  const no = spawnSync('node', [CLI('fix-state.mjs'), '--current', 'relevo:ready'], { encoding: 'utf8' });
  assert.equal(no.status, 1);
  assert.equal(JSON.parse(no.stdout).allowed, false);
  assert.equal(spawnSync('node', [CLI('fix-state.mjs')], { encoding: 'utf8' }).status, 2);
});

// ---------- Specification first: corrections section

const TASKS = '## 1. Build\n\n- [x] 1.1 Screen\n- [x] 1.2 Tests\n\n## 2. Polish\n\n- [x] 2.1 Strings\n';

test('Scenario: New feedback - a corrections section with unchecked tasks is appended', () => {
  const { text, section, iteration, ids } = addCorrections(TASKS, ['Handle the empty state', 'Disable the button while saving']);
  assert.equal(section, 3);
  assert.equal(iteration, 1);
  assert.deepEqual(ids, ['3.1', '3.2']);
  assert.match(text, /## 3\. Review corrections \[Iteration 1\]\n\n- \[ \] 3\.1 Handle the empty state\n- \[ \] 3\.2 Disable the button while saving\n$/);
  assert.ok(text.startsWith(TASKS.trimEnd()), 'earlier content is untouched');
  assert.deepEqual(uncheckedTasks(text), ['3.1', '3.2']);
});

test('each new round of feedback is its own iteration', () => {
  const first = addCorrections(TASKS, ['one']).text;
  const second = addCorrections(first.replace('- [ ] 3.1', '- [x] 3.1'), ['two']);
  assert.equal(second.section, 4);
  assert.equal(second.iteration, 2);
  assert.match(second.text, /## 4\. Review corrections \[Iteration 2\]/);
  assert.deepEqual(uncheckedTasks(second.text), ['4.1']);
});

test('a correction needs a task, and blank titles do not count', () => {
  assert.throws(() => addCorrections(TASKS, []), /at least one correction task/);
  assert.throws(() => addCorrections(TASKS, ['  ', '']), /at least one correction task/);
});

test('add-corrections CLI edits the file in place', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-'));
  const file = join(dir, 'tasks.md');
  writeFileSync(file, TASKS);
  const out = JSON.parse(execFileSync('node', [CLI('add-corrections.mjs'), file, 'Fix A', 'Fix B'], { encoding: 'utf8' }));
  assert.deepEqual(out, { section: 3, iteration: 1, ids: ['3.1', '3.2'] });
  assert.match(readFileSync(file, 'utf8'), /- \[ \] 3\.2 Fix B/);
  assert.equal(spawnSync('node', [CLI('add-corrections.mjs'), file], { encoding: 'utf8' }).status, 2);
});

// ---------- Specification first: the guard

const DIR = 'openspec/changes/31-summary';
const specAdd = ['+#### Scenario: Empty list', '+- **WHEN** nothing to show', '+- **THEN** a message appears'];
const taskAdd = ['+## 3. Review corrections [Iteration 1]', '+- [ ] 3.1 Handle the empty state'];

test('the developer may run once the specification and tasks describe the correction', () => {
  const r = checkSpecFirst({ changedFiles: [`${DIR}/specs/a/spec.md`, `${DIR}/tasks.md`], changeDir: DIR, specLinesAdded: specAdd, taskLinesAdded: taskAdd });
  assert.deepEqual(r, { ok: true, reasons: [] });
});

test('Scenario: code edited before the specification - the guard refuses', () => {
  const r = checkSpecFirst({ changedFiles: [`${DIR}/tasks.md`, 'lib/summary.dart'], changeDir: DIR, specLinesAdded: specAdd, taskLinesAdded: taskAdd });
  assert.equal(r.ok, false);
  assert.match(r.reasons[0], /outside the change folder.*lib\/summary\.dart/);
});

test('the guard needs a scenario and a task', () => {
  const noScenario = checkSpecFirst({ changedFiles: [`${DIR}/tasks.md`], changeDir: DIR, specLinesAdded: ['+Some prose'], taskLinesAdded: taskAdd });
  assert.match(noScenario.reasons.join(' '), /no scenario describing the corrected behaviour/);
  const noTask = checkSpecFirst({ changedFiles: [`${DIR}/specs/a/spec.md`], changeDir: DIR, specLinesAdded: specAdd, taskLinesAdded: [] });
  assert.match(noTask.reasons.join(' '), /no unchecked correction task/);
  const checked = checkSpecFirst({ changedFiles: [], changeDir: DIR, specLinesAdded: specAdd, taskLinesAdded: ['+- [x] 3.1 done'] });
  assert.match(checked.reasons.join(' '), /no unchecked correction task/);
});

test('a corrected scenario (WHEN/THEN rewritten) counts, not only new scenario headings', () => {
  const r = checkSpecFirst({ changedFiles: [`${DIR}/specs/a/spec.md`, `${DIR}/tasks.md`], changeDir: DIR, specLinesAdded: ['+- **THEN** the corrected result'], taskLinesAdded: taskAdd });
  assert.equal(r.ok, true);
});

test('fix-guard CLI against a real git repository', () => {
  const repo = mkdtempSync(join(tmpdir(), 'relevo-'));
  const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
  const guard = () => spawnSync('node', [CLI('fix-guard.mjs'), DIR], { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'a@b.c');
  git('config', 'user.name', 't');
  mkdirSync(join(repo, DIR, 'specs', 'a'), { recursive: true });
  mkdirSync(join(repo, 'lib'), { recursive: true });
  writeFileSync(join(repo, DIR, 'specs', 'a', 'spec.md'), '#### Scenario: Old\n- **WHEN** a\n- **THEN** b\n');
  writeFileSync(join(repo, DIR, 'tasks.md'), TASKS);
  writeFileSync(join(repo, 'lib', 'summary.dart'), '// code\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'baseline');

  assert.equal(guard().status, 1, 'nothing changed yet');

  writeFileSync(join(repo, 'lib', 'summary.dart'), '// code edited too early\n');
  assert.match(guard().stdout, /outside the change folder/);
  git('checkout', '--', 'lib');

  writeFileSync(join(repo, DIR, 'specs', 'a', 'spec.md'), '#### Scenario: Old\n- **WHEN** a\n- **THEN** b\n\n#### Scenario: Empty list\n- **WHEN** nothing\n- **THEN** a message\n');
  assert.equal(guard().status, 1, 'the scenario is there but no task yet');
  execFileSync('node', [CLI('add-corrections.mjs'), join(repo, DIR, 'tasks.md'), 'Handle the empty state']);
  const ready = guard();
  assert.equal(ready.status, 0, ready.stdout);
  assert.match(ready.stdout, /developer may run/);
});

// ---------- the comment

test('the fix comment summarises the change, the QA verdict and the commit, and asks the recipient to act', () => {
  const text = renderMessage('fix_done', {
    issue: 31, title: 'Summary screen', iteration: 2, summary: 'the empty state is now handled',
    qa: 'QA PASSED', commit: 'a1b2c3d', recipient: 'persona-c', ask: 'please re-review',
  });
  assert.match(text, /^#31 "Summary screen" fixed \(iteration 2\)/);
  assert.match(text, /What changed: the empty state is now handled/);
  assert.match(text, /QA: QA PASSED/);
  assert.match(text, /Commit: a1b2c3d/);
  assert.match(text, /@persona-c please re-review/);
});

test('with nobody to notify the comment mentions no one', () => {
  const text = renderMessage('fix_done', { issue: 1, title: 't', iteration: 1, summary: 's', qa: 'QA PASSED', commit: 'abc' });
  assert.doesNotMatch(text, /@/);
  assert.match(renderMessage('fix_done', { issue: 1, title: 't', iteration: 1, summary: 's', qa: 'QA PASSED', commit: 'abc' }, 'es'), /corregido \(iteración 1\)/);
});
