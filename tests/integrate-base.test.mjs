import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyConflicts, integrateBase } from '../scripts/lib/integrate-base.mjs';

const CLI = new URL('../scripts/integrate-base.mjs', import.meta.url).pathname;
const CONFIG = 'limits:\n  run_max_cost: 5\nintegration:\n  generated:\n    - gen.txt\n  regenerate: echo regenerated > gen.txt\n';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

// A repository with a remote and a feature branch checked out. `onBase` and `onFeature` write files before each commit.
function world({ onBase = {}, onFeature = {}, config = CONFIG } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-integrate-'));
  const origin = join(dir, 'origin.git');
  const work = join(dir, 'work');
  git(dir, 'init', '-q', '--bare', '-b', 'dev', origin);
  git(dir, 'clone', '-q', origin, work);
  [['user.email', 't@example.com'], ['user.name', 'T'], ['commit.gpgsign', 'false']].forEach(([k, v]) => git(work, 'config', k, v));
  const write = (files) => Object.entries(files).forEach(([f, c]) => writeFileSync(join(work, f), c));
  write({ 'a.txt': 'a\n', 'b.txt': 'b\n', 'gen.txt': 'generated 0\n', 'relevo.yml': config });
  git(work, 'checkout', '-q', '-b', 'dev');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'start');
  git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', '-b', 'feature/1-x');
  write(onFeature);
  git(work, 'add', '.');
  git(work, 'commit', '-q', '--allow-empty', '-m', 'feature');
  if (Object.keys(onBase).length > 0) {
    git(work, 'checkout', '-q', 'dev');
    write(onBase);
    git(work, 'add', '.');
    git(work, 'commit', '-q', '-m', 'base moved');
    git(work, 'push', '-q', 'origin', 'dev');
    git(work, 'checkout', '-q', 'feature/1-x');
    git(work, 'reset', '-q', '--hard', 'HEAD'); // the working tree is the feature's
    git(work, 'branch', '-q', '-f', 'dev', 'origin/dev~0');
  }
  return work;
}

const cli = (work) => {
  const r = spawnSync('node', [CLI, '--base', 'dev', '--config', join(work, 'relevo.yml')], { cwd: work, encoding: 'utf8' });
  return { status: r.status, out: r.stdout ? JSON.parse(r.stdout) : null, err: r.stderr };
};

test('classifyConflicts splits generated files from the others', () => {
  assert.deepEqual(classifyConflicts(['src/gql/t.ts', 'router.ts', 'src/gql/t.ts'], ['src/gql/**']), { generated: ['src/gql/t.ts'], other: ['router.ts'] });
  assert.deepEqual(classifyConflicts([], ['x']), { generated: [], other: [] });
});

test('Scenario: The base did not move - nothing is merged', () => {
  const work = world({ onFeature: { 'a.txt': 'a feature\n' } });
  const before = git(work, 'rev-parse', 'HEAD');
  const r = cli(work);
  assert.equal(r.status, 0, r.err);
  assert.equal(r.out.outcome, 'unchanged');
  assert.equal(git(work, 'rev-parse', 'HEAD'), before);
});

test('Scenario: The base moved without a conflict - it is merged', () => {
  const work = world({ onFeature: { 'a.txt': 'a feature\n' }, onBase: { 'b.txt': 'b base\n' } });
  const r = cli(work);
  assert.equal(r.status, 0, r.err);
  assert.equal(r.out.outcome, 'merged');
  assert.equal(readFileSync(join(work, 'b.txt'), 'utf8'), 'b base\n');
  assert.equal(readFileSync(join(work, 'a.txt'), 'utf8'), 'a feature\n');
  assert.equal(git(work, 'status', '--porcelain'), '');
});

test('Scenario: A generated file conflicts - it is regenerated and the merge is committed', () => {
  const work = world({ onFeature: { 'gen.txt': 'generated feature\n' }, onBase: { 'gen.txt': 'generated base\n' } });
  const r = cli(work);
  assert.equal(r.status, 0, r.err);
  assert.equal(r.out.outcome, 'regenerated');
  assert.deepEqual(r.out.files, ['gen.txt']);
  assert.equal(readFileSync(join(work, 'gen.txt'), 'utf8'), 'regenerated\n');
  assert.equal(git(work, 'status', '--porcelain'), '');
  assert.equal(git(work, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ').length, 3, 'the last commit is a merge');
});

test('Scenario: Another file conflicts - the tree is left as it was and the files are named', () => {
  const work = world({ onFeature: { 'a.txt': 'a feature\n', 'gen.txt': 'generated feature\n' }, onBase: { 'a.txt': 'a base\n', 'gen.txt': 'generated base\n' } });
  const before = git(work, 'rev-parse', 'HEAD');
  const r = cli(work);
  assert.equal(r.status, 1);
  assert.equal(r.out.outcome, 'conflict');
  assert.deepEqual(r.out.files, ['a.txt'], 'only the file that is not generated');
  assert.equal(git(work, 'rev-parse', 'HEAD'), before);
  assert.equal(git(work, 'status', '--porcelain'), '');
  assert.equal(readFileSync(join(work, 'a.txt'), 'utf8'), 'a feature\n');
});

test('Scenario: The merge cannot be probed - the merge is attempted in the working tree with the same outcomes', () => {
  const noProbe = (work) => (...args) => (args[0] === 'merge-tree' ? { status: 129, stdout: '', stderr: '' } : spawnSync('git', args, { cwd: work, encoding: 'utf8' }));
  const commandIn = (work) => (command) => spawnSync('sh', ['-c', command], { cwd: work, encoding: 'utf8' });
  const opts = (work) => ({ run: noProbe(work), runCommand: commandIn(work), base: 'origin/dev', generated: ['gen.txt'], regenerate: 'echo regenerated > gen.txt' });

  const clean = world({ onFeature: { 'a.txt': 'a feature\n' }, onBase: { 'b.txt': 'b base\n' } });
  assert.equal(integrateBase(opts(clean)).outcome, 'merged');
  assert.equal(git(clean, 'status', '--porcelain'), '');

  const generated = world({ onFeature: { 'gen.txt': 'generated feature\n' }, onBase: { 'gen.txt': 'generated base\n' } });
  assert.equal(integrateBase(opts(generated)).outcome, 'regenerated');

  const other = world({ onFeature: { 'a.txt': 'a feature\n' }, onBase: { 'a.txt': 'a base\n' } });
  const before = git(other, 'rev-parse', 'HEAD');
  const r = integrateBase(opts(other));
  assert.equal(r.outcome, 'conflict');
  assert.deepEqual(r.files, ['a.txt']);
  assert.equal(git(other, 'rev-parse', 'HEAD'), before);
  assert.equal(git(other, 'status', '--porcelain'), '');
});

test('Scenario: The regenerate command fails - nothing is merged and the message says why', () => {
  const work = world({ onFeature: { 'gen.txt': 'generated feature\n' }, onBase: { 'gen.txt': 'generated base\n' }, config: 'limits:\n  run_max_cost: 5\nintegration:\n  generated:\n    - gen.txt\n  regenerate: exit 3\n' });
  const before = git(work, 'rev-parse', 'HEAD');
  const r = cli(work);
  assert.equal(r.status, 2);
  assert.equal(r.out.outcome, 'failed');
  assert.match(r.out.message, /regenerate command failed/);
  assert.equal(git(work, 'rev-parse', 'HEAD'), before);
  assert.equal(git(work, 'status', '--porcelain'), '');
});

test('the script refuses a missing --base and an invalid configuration', () => {
  assert.equal(spawnSync('node', [CLI], { encoding: 'utf8' }).status, 2);
  const work = world({ config: 'limits:\n  run_max_cost: 5\nintegration:\n  generated:\n    - gen.txt\n' });
  const r = spawnSync('node', [CLI, '--base', 'dev', '--config', join(work, 'relevo.yml')], { cwd: work, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /integration\.regenerate/);
});
