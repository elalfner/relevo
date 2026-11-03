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

// --- handing a conflict to the developer agent (spec: review, "Synchronise with the base branch first")
import { conflictHandoff } from '../scripts/lib/conflict-handoff.mjs';

test('Scenario: The agent resolves a conflict - files inside the folder of the platform may be handed over', () => {
  const r = conflictHandoff(['apps/web/src/Table.vue', 'apps/web/src/index.css'], { within: 'apps/web', change: '42-x' });
  assert.deepEqual([r.ok, r.outside], [true, []]);
});

test('Scenario: A conflict outside the folder of the platform - it is not handed over and the path is named', () => {
  const r = conflictHandoff(['apps/web/src/a.ts', 'apps/api/src/b.ts'], { within: 'apps/web', change: '42-x' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.outside.map((o) => o.path), ['apps/api/src/b.ts']);
  assert.match(r.outside[0].reason, /outside the platform \(apps\/web\)/);
});

test('the specification of the change, the glossary and the decision records are inside, another change is not', () => {
  assert.equal(conflictHandoff(['openspec/changes/42-x/tasks.md', 'GLOSSARY.md', 'docs/adr/0003-x.md'], { within: 'apps/web', change: '42-x' }).ok, true);
  assert.equal(conflictHandoff(['openspec/changes/43-y/tasks.md'], { within: 'apps/web', change: '42-x' }).ok, false);
});

test('a platform at the root has no folder to leave, but a protected path or a restricted file still stops the handoff', () => {
  assert.equal(conflictHandoff(['src/a.ts'], { within: '.', change: '1-x' }).ok, true);
  const hard = conflictHandoff(['src/a.ts', '.github/workflows/ci.yml'], { within: '.', change: '1-x' });
  assert.deepEqual(hard.outside.map((o) => o.path), ['.github/workflows/ci.yml']);
  assert.match(hard.outside[0].reason, /protected path/);
  assert.match(conflictHandoff(['.env.production'], { within: '.', change: '1-x' }).outside[0].reason, /restricted file/);
});

test('a dependency file in conflict is handed over only when the issue allows it', () => {
  assert.equal(conflictHandoff(['package-lock.json'], { within: '.', change: '1-x' }).ok, false);
  assert.match(conflictHandoff(['package-lock.json'], { within: '.', change: '1-x' }).outside[0].reason, /Allow-paths/);
  assert.equal(conflictHandoff(['package-lock.json'], { within: '.', change: '1-x', allow: ['package-lock.json'] }).ok, true);
});

test('no conflicts is a handoff that is fine', () => {
  assert.deepEqual(conflictHandoff([], { within: 'apps/web', change: '1-x' }), { ok: true, paths: [], outside: [] });
});

test('the script answers the question of review in JSON and exits 1 when a file may not go to the agent', () => {
  const run = (input, ...args) => spawnSync('node', [CLI, '--handoff', '--paths', ...args], { input, encoding: 'utf8' });
  const ok = run('apps/web/src/a.ts\n', '--within', 'apps/web', '--change', '1-x');
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).ok, true);
  const bad = run('apps/web/src/a.ts\napps/api/b.ts\n', '--within', 'apps/web', '--change', '1-x');
  assert.equal(bad.status, 1);
  assert.deepEqual(JSON.parse(bad.stdout).outside.map((o) => o.path), ['apps/api/b.ts']);
  assert.equal(run('package.json\n', '--within', '.', '--allow', 'package.json').status, 0);
});
