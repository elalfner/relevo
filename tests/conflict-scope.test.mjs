import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conflictScope } from '../scripts/lib/archive-check.mjs';

const CLI = new URL('../scripts/conflict-scope.mjs', import.meta.url).pathname;

test('conflictScope: inside, outside and none', () => {
  assert.equal(conflictScope(['openspec/specs/a/spec.md']).ok, true);
  assert.equal(conflictScope([]).ok, true);
  assert.deepEqual(conflictScope(['openspec/specs/a/spec.md', 'lib/main.dart']).outside, ['lib/main.dart']);
  assert.equal(conflictScope(['openspec-old/a.md']).ok, false);
});

test('the script reads paths from stdin', () => {
  const inside = spawnSync('node', [CLI, '--paths'], { input: 'openspec/specs/a/spec.md\n', encoding: 'utf8' });
  assert.equal(inside.status, 0);
  const outside = spawnSync('node', [CLI, '--paths'], { input: 'openspec/specs/a/spec.md\nlib/main.dart\n', encoding: 'utf8' });
  assert.equal(outside.status, 1);
  assert.match(outside.stdout, /lib\/main\.dart/);
});

function conflicted(file) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-cs-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  mkdirSync(join(dir, file, '..'), { recursive: true });
  writeFileSync(join(dir, file), 'base\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  git('switch', '-q', '-c', 'feature');
  writeFileSync(join(dir, file), 'feature\n');
  git('commit', '-q', '-am', 'feature');
  git('switch', '-q', 'main');
  writeFileSync(join(dir, file), 'main\n');
  git('commit', '-q', '-am', 'main');
  assert.equal(git('merge', 'feature').status, 1, 'the merge must conflict');
  return dir;
}

test('Scenario: Conflict only in specifications - a real merge conflict inside openspec/ exits 0', () => {
  const dir = conflicted('openspec/specs/a/spec.md');
  const r = spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /under openspec\//);
});

test('Scenario: Conflict in code - a real merge conflict in a code file exits 1 and names it', () => {
  const dir = conflicted('lib/main.dart');
  const r = spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /lib\/main\.dart/);
});

test('no conflicts is fine', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-cs-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  assert.equal(spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' }).status, 0);
});
