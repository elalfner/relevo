import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addCorrections, correctionSection } from '../scripts/lib/tasks-file.mjs';
import { checkFixTasks } from '../scripts/lib/tasks-file.mjs';

const BASE = '# Tasks\n\n## 1. Build\n\n- [x] 1.1 First\n- [x] 1.2 Second\n';
const withCorrections = (titles, base = BASE) => addCorrections(base, titles).text;

test('correctionSection reads the last section only', () => {
  const t = withCorrections(['Test: old'], withCorrections(['Test: first']));
  const s = correctionSection(t);
  assert.equal(s.found, true);
  assert.deepEqual(s.ids, ['3.1']);
  assert.equal(correctionSection(BASE).found, false);
});

test('Scenario: An old task is still open', () => {
  const base = BASE.replace('- [x] 1.2', '- [ ] 1.2');
  const r = checkFixTasks(withCorrections(['Handle the case', 'Test: the case'], base), 'before');
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /1\.2/);
});

test('corrections only, with a test task, pass before the developer', () => {
  assert.equal(checkFixTasks(withCorrections(['Handle the case', 'Test: the case']), 'before').ok, true);
});

test('Scenario: No regression test', () => {
  const r = checkFixTasks(withCorrections(['Handle the case']), 'before');
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /regression test/);
});

test('Scenario: Device-only correction needs no test task', () => {
  assert.equal(checkFixTasks(withCorrections(['Move the button (device only)']), 'before').ok, true);
  const mixed = checkFixTasks(withCorrections(['Move the button (device only)', 'Fix the total']), 'before');
  assert.equal(mixed.ok, false);
});

test('a list with no correction section fails before the developer', () => {
  const r = checkFixTasks(BASE, 'before');
  assert.equal(r.ok, false);
  assert.match(r.reasons[0], /Review corrections/);
});

test('Scenario: A correction is left open', () => {
  const open = withCorrections(['Handle the case', 'Test: the case']).replace('- [ ] 2.1', '- [x] 2.1');
  const r = checkFixTasks(open, 'after');
  assert.equal(r.ok, false);
  assert.match(r.reasons[0], /2\.2/);
  const done = open.replace('- [ ] 2.2', '- [x] 2.2');
  assert.equal(checkFixTasks(done, 'after').ok, true);
});

test('the script prints the reasons and exits 1, 0 or 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-ft-'));
  const file = join(dir, 'tasks.md');
  const cli = (...a) => spawnSync('node', [new URL('../scripts/fix-tasks.mjs', import.meta.url).pathname, ...a], { encoding: 'utf8' });
  writeFileSync(file, withCorrections(['Handle the case']));
  const bad = cli('--file', file, '--stage', 'before');
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /regression test/);
  writeFileSync(file, withCorrections(['Handle the case', 'Test: the case']));
  assert.equal(cli('--file', file, '--stage', 'before').status, 0);
  assert.equal(cli('--file', file, '--stage', 'x').status, 2);
});
