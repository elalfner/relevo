import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyBranchChanges, recoveryForBranch } from '../scripts/lib/branch.mjs';

const CLI = new URL('../scripts/branch-state.mjs', import.meta.url).pathname;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), text);
};

// A remote with `main` and four feature branches, and a clone to run the command in.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'relevo-branch-'));
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  git(root, 'init', '--bare', '-q', '-b', 'main', remote);
  git(root, 'clone', '-q', remote, work);
  git(work, 'config', 'user.email', 'a@b');
  git(work, 'config', 'user.name', 't');
  put(work, 'README.md', 'base\n');
  git(work, 'add', '.');
  git(work, 'commit', '-qm', 'base');
  git(work, 'push', '-q', 'origin', 'main');
  const branch = (name, files) => {
    git(work, 'switch', '-q', '-c', name, 'main');
    Object.entries(files).forEach(([path, text]) => put(work, path, text));
    if (Object.keys(files).length) {
      git(work, 'add', '.');
      git(work, 'commit', '-qm', name);
    }
    git(work, 'push', '-q', 'origin', name);
    git(work, 'switch', '-q', 'main');
  };
  branch('feature/31-summary', { 'openspec/changes/31-summary/proposal.md': 'p\n' });
  branch('feature/32-built', { 'openspec/changes/32-built/proposal.md': 'p\n', 'lib/main.dart': 'void main() {}\n' });
  branch('feature/33-empty', {});
  return work;
}

const run = (cwd, ...args) => spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });
const work = fixture();

test('Scenario: Branch already exists with only the specification - spec-only', () => {
  const r = run(work, 'main', 'feature/31-summary', '31-summary');
  assert.deepEqual([r.status, r.stdout.trim()], [0, 'spec-only']);
});

test('Scenario: Branch already exists with implementation commits - implementation', () => {
  assert.equal(run(work, 'main', 'feature/32-built', '32-built').stdout.trim(), 'implementation');
});

test('a branch with no commits beyond the base is empty, and a branch that does not exist is absent', () => {
  assert.equal(run(work, 'main', 'feature/33-empty', '33-empty').stdout.trim(), 'empty');
  const absent = run(work, 'main', 'feature/99-nope', '99-nope');
  assert.deepEqual([absent.status, absent.stdout.trim()], [0, 'absent']);
});

test('bad arguments exit 2 with the usage', () => {
  const r = run(work, 'main');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: branch-state\.mjs/);
});

test('outside a repository the command fails clearly instead of printing a wrong answer', () => {
  const r = run(mkdtempSync(join(tmpdir(), 'relevo-norepo-')), 'main', 'feature/1-x', '1-x');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /could not read the branch/);
});

test('Scenario: Branch already exists - the content of the branch decides the recovery', () => {
  const id = '31-summary';
  assert.equal(classifyBranchChanges([], id), 'empty');
  assert.equal(classifyBranchChanges(['', '  '], id), 'empty');
  assert.equal(classifyBranchChanges(['openspec/changes/31-summary/proposal.md', 'openspec/changes/31-summary/specs/x/spec.md'], id), 'spec-only');
  assert.equal(classifyBranchChanges(['openspec/changes/31-summary/tasks.md', 'lib/main.dart'], id), 'implementation');
  assert.equal(classifyBranchChanges(['openspec/changes/32-other/tasks.md'], id), 'implementation', 'the specification of another change is not this one');
  assert.equal(classifyBranchChanges(['openspec/changes/31-summary-extra/tasks.md'], id), 'implementation', 'a longer name is not the same folder');
  assert.equal(recoveryForBranch('implementation'), 'fix');
  assert.equal(recoveryForBranch('spec-only'), 'delete-branch');
  assert.equal(recoveryForBranch('empty'), 'delete-branch');
});
