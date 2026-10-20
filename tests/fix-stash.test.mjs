import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findStash, stashMessage } from '../scripts/lib/fix-stash.mjs';

const CLI = new URL('../scripts/fix-stash.mjs', import.meta.url).pathname;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-stash-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  git('add', 'a.txt');
  git('commit', '-q', '-m', 'init');
  const cli = (...a) => spawnSync('node', [CLI, ...a], { cwd: dir, encoding: 'utf8' });
  return { dir, git, cli };
}

test('Scenario: QA rejects after the retries - the changes are saved under the name of the issue and the tree is clean', () => {
  const { dir, git, cli } = repo();
  writeFileSync(join(dir, 'a.txt'), 'two\n');
  writeFileSync(join(dir, 'new.txt'), 'untracked\n');
  const r = cli('save', '--issue', '42', '--iteration', '2');
  assert.equal(r.status, 0, r.stderr);
  assert.match(git('stash', 'list'), /relevo-fix #42 iteration 2/);
  assert.equal(git('status', '--porcelain').trim(), '');
  assert.equal(stashMessage(42, 2), 'relevo-fix #42 iteration 2');
});

test('save refuses a clean tree', () => {
  const { cli } = repo();
  const r = cli('save', '--issue', '42', '--iteration', '1');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /clean/);
});

test('Scenario: Resuming - find returns the newest stash of the issue and ignores other stashes and issues', () => {
  const { dir, git, cli } = repo();
  writeFileSync(join(dir, 'a.txt'), 'x\n');
  git('stash', 'push', '-m', 'someone elses work');
  writeFileSync(join(dir, 'a.txt'), 'y\n');
  cli('save', '--issue', '4', '--iteration', '1');
  writeFileSync(join(dir, 'a.txt'), 'z\n');
  cli('save', '--issue', '42', '--iteration', '1');
  writeFileSync(join(dir, 'a.txt'), 'w\n');
  cli('save', '--issue', '42', '--iteration', '2');
  const found = JSON.parse(cli('find', '--issue', '42').stdout);
  assert.equal(found.iteration, 2);
  assert.equal(found.message, 'relevo-fix #42 iteration 2');
  assert.equal(findStash(git('stash', 'list'), 4).iteration, 1);
  assert.equal(findStash(git('stash', 'list'), 7), null);
  assert.equal(cli('find', '--issue', '7').status, 1);
});

test('pop restores the work, untracked files included', () => {
  const { dir, git, cli } = repo();
  writeFileSync(join(dir, 'a.txt'), 'two\n');
  writeFileSync(join(dir, 'new.txt'), 'untracked\n');
  cli('save', '--issue', '42', '--iteration', '1');
  const r = cli('pop', '--issue', '42');
  assert.equal(r.status, 0, r.stderr);
  assert.match(git('status', '--porcelain'), /a\.txt/);
  assert.match(git('status', '--porcelain'), /new\.txt/);
  assert.equal(git('stash', 'list').trim(), '');
});

test('Scenario: Restore conflicts - exit 1, the files are named and the stash is kept', () => {
  const { dir, git, cli } = repo();
  writeFileSync(join(dir, 'a.txt'), 'mine\n');
  cli('save', '--issue', '42', '--iteration', '1');
  writeFileSync(join(dir, 'a.txt'), 'theirs\n');
  git('commit', '-q', '-am', 'other change');
  const r = cli('pop', '--issue', '42');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /a\.txt/);
  assert.match(git('stash', 'list'), /relevo-fix #42 iteration 1/);
});

test('Scenario: Start from scratch - drop removes only the matching stash', () => {
  const { dir, git, cli } = repo();
  writeFileSync(join(dir, 'a.txt'), 'x\n');
  git('stash', 'push', '-m', 'someone elses work');
  writeFileSync(join(dir, 'a.txt'), 'y\n');
  cli('save', '--issue', '42', '--iteration', '1');
  assert.equal(cli('drop', '--issue', '42').status, 0);
  const left = git('stash', 'list');
  assert.match(left, /someone elses work/);
  assert.doesNotMatch(left, /relevo-fix/);
});

test('bad arguments exit 2', () => {
  const { cli } = repo();
  assert.equal(cli('save', '--issue', 'x').status, 2);
  assert.equal(cli('nope').status, 2);
});
