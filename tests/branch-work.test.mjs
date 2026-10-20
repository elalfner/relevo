import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasImplementation } from '../scripts/lib/branch-work.mjs';

const CLI = new URL('../scripts/branch-work.mjs', import.meta.url).pathname;
const DIR = 'openspec/changes/31-summary';

test('Scenario: Branch with only the specification', () => {
  assert.equal(hasImplementation([`${DIR}/tasks.md`, `${DIR}/specs/a/spec.md`], DIR).implementation, false);
  assert.equal(hasImplementation([], DIR).implementation, false);
});

test('Scenario: Branch with code - the files outside the folder are listed', () => {
  const r = hasImplementation([`${DIR}/tasks.md`, 'lib/main.dart'], DIR);
  assert.equal(r.implementation, true);
  assert.deepEqual(r.files, ['lib/main.dart']);
});

test('a folder with a similar prefix is outside the change folder', () => {
  assert.equal(hasImplementation(['openspec/changes/31-summary-old/tasks.md'], DIR).implementation, true);
});

function repoWithBranch(files) {
  const origin = mkdtempSync(join(tmpdir(), 'relevo-bw-'));
  const git = (...a) => execFileSync('git', a, { cwd: origin, encoding: 'utf8' });
  git('init', '-q', '-b', 'dev');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  writeFileSync(join(origin, 'README.md'), 'x\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  git('update-ref', 'refs/remotes/origin/dev', 'HEAD');
  git('switch', '-q', '-c', 'feature/31-summary');
  files.forEach((f) => {
    mkdirSync(join(origin, f, '..'), { recursive: true });
    writeFileSync(join(origin, f), 'y\n');
  });
  git('add', '.');
  git('commit', '-q', '-m', 'work');
  return origin;
}

test('the script exits 1 for a specification-only branch and 0 for one with code', () => {
  const spec = repoWithBranch([`${DIR}/tasks.md`]);
  const r1 = spawnSync('node', [CLI, '--base', 'dev', '--change', '31-summary'], { cwd: spec, encoding: 'utf8' });
  assert.equal(r1.status, 1);
  assert.match(r1.stderr, /relevo:ready/);
  const code = repoWithBranch([`${DIR}/tasks.md`, 'lib/main.dart']);
  const r2 = spawnSync('node', [CLI, '--base', 'dev', '--change', '31-summary'], { cwd: code, encoding: 'utf8' });
  assert.equal(r2.status, 0);
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
});
