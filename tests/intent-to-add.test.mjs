import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../scripts/intent-to-add.mjs', import.meta.url).pathname;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), text);
};
const run = (cwd, ...args) => spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-ita-'));
  git(dir, 'init', '-q', '-b', 'dev');
  git(dir, 'config', 'user.email', 'a@b');
  git(dir, 'config', 'user.name', 't');
  put(dir, '.gitignore', 'build/\n');
  put(dir, 'lib/old.dart', 'old\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}

test('Scenario: New file in the diff - after the command, git diff against the base shows it; before, it did not', () => {
  const dir = repo();
  put(dir, 'lib/old.dart', 'old changed\n');
  put(dir, 'lib/new.dart', 'brand new\n');
  assert.doesNotMatch(git(dir, 'diff', 'HEAD'), /new\.dart/, 'git diff does not show untracked files');
  const r = run(dir, 'lib/old.dart', 'lib/new.dart');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /marked 2 file\(s\)/);
  const diff = git(dir, 'diff', 'HEAD');
  assert.match(diff, /\+brand new/);
  assert.match(diff, /\+old changed/);
});

test('the content is not staged: the commit that follows still has to add it', () => {
  const dir = repo();
  put(dir, 'lib/new.dart', 'brand new\n');
  run(dir, 'lib/new.dart');
  assert.equal(git(dir, 'diff', '--cached', '--stat').trim(), '', 'nothing is staged with content');
  assert.match(git(dir, 'status', '--short'), /^ ?A {1,2}lib\/new\.dart/m);
});

test('Scenario: Generated files - an ignored file is skipped without failing', () => {
  const dir = repo();
  put(dir, 'build/out.js', 'generated\n');
  put(dir, 'lib/new.dart', 'x\n');
  const r = run(dir, 'build/out.js', 'lib/new.dart');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /marked 1 file\(s\) for the diff, skipped 1 ignored by git/);
  assert.doesNotMatch(git(dir, 'diff', 'HEAD'), /out\.js/);
});

test('a file the developer reported but that is gone is skipped', () => {
  const dir = repo();
  put(dir, 'lib/new.dart', 'x\n');
  const r = run(dir, 'lib/new.dart', 'lib/deleted.dart');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /marked 1 file\(s\) for the diff, skipped 1 that do not exist/);
});

test('"." and "-A" are refused, and so is an empty list', () => {
  const dir = repo();
  put(dir, 'lib/new.dart', 'x\n');
  assert.equal(run(dir, '.').status, 2);
  assert.match(run(dir, '-A').stderr, /refusing to stage/);
  assert.equal(run(dir).status, 2);
  assert.doesNotMatch(git(dir, 'status', '--short'), /^ ?A/m, 'nothing was marked');
});

test('a file that is already tracked is accepted and unchanged', () => {
  const dir = repo();
  const r = run(dir, 'lib/old.dart');
  assert.equal(r.status, 0);
  assert.equal(git(dir, 'status', '--short').trim(), '');
});
