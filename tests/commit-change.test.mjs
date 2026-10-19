import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../scripts/commit-change.mjs', import.meta.url).pathname;
// The markers and the fake token are built here so that this file does not trip the scan it tests.
const MARKER = ['NO', 'COMMIT'].join('');
const TEMP = ['TE', 'MP'].join('');
const FAKE_TOKEN = ['ghp', '_abcdefghijklmnopqrstuvwxyz0123456789'].join('');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), text);
};

function repo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-commit-'));
  git(dir, 'init', '-q', '-b', 'dev');
  git(dir, 'config', 'user.email', 'a@b');
  git(dir, 'config', 'user.name', 't');
  put(dir, 'README.md', 'base\n');
  Object.entries(files).forEach(([path, text]) => put(dir, path, text));
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}
const run = (cwd, ...args) => spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });
const head = (dir) => git(dir, 'rev-parse', 'HEAD').trim();
const staged = (dir) => git(dir, 'diff', '--cached', '--name-only').trim().split('\n').filter(Boolean);

test('a clean change is committed with its message and the short hash is printed', () => {
  const dir = repo();
  put(dir, 'lib/a.dart', 'void a() {}\n');
  const r = run(dir, '--message', 'feat: add a (#7)', '--', 'lib/a.dart');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout.trim(), /^[0-9a-f]{7,}$/);
  assert.equal(git(dir, 'log', '-1', '--format=%s').trim(), 'feat: add a (#7)');
  assert.deepEqual(git(dir, 'show', '--name-only', '--format=', 'HEAD').trim().split('\n'), ['lib/a.dart']);
});

test('Scenario: Temporary marker staged - nothing is committed, the file is named, and the work stays in the tree', () => {
  const dir = repo();
  put(dir, 'lib/a.dart', `var x = 1; // ${MARKER} remove me\n`);
  const before = head(dir);
  const r = run(dir, '--message', 'feat: x', '--', 'lib/a.dart');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /lib\/a\.dart:1 {2}temporary marker \(NOCOMMIT\)/);
  assert.equal(head(dir), before);
  assert.deepEqual(staged(dir), [], 'the named path is unstaged again');
  assert.match(git(dir, 'status', '--short'), /\?\? lib\//, 'the file is still there');
});

test('Scenario: Credential found before pushing - refused, and the secret is never printed', () => {
  const dir = repo();
  const secret = FAKE_TOKEN;
  put(dir, 'lib/a.dart', `const t = "${secret}";\n`);
  const r = run(dir, '--message', 'feat: x', '--', 'lib/a.dart');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /possible credential \(github-token\)/);
  assert.ok(!r.stdout.includes(secret) && !r.stderr.includes(secret));
});

test('Scenario: Workflow edited - a hard-protected path is refused even when allowed, before anything is staged', () => {
  const dir = repo();
  put(dir, '.github/workflows/ci.yml', 'name: ci\n');
  const r = run(dir, '--message', 'chore: ci', '--allow', '.github/**,.github/workflows/ci.yml', '--', '.github/workflows/ci.yml');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\.github\/workflows\/ci\.yml {2}protected path \(\.github\/\)/);
  assert.deepEqual(staged(dir), []);
});

test('the Relevo configuration and the folders of skills are refused as well', () => {
  const dir = repo();
  put(dir, 'relevo.yml', 'limits:\n  run_max_cost: 5\n');
  put(dir, '.claude/skills/x/SKILL.md', 'x\n');
  assert.equal(run(dir, '--message', 'm', '--', 'relevo.yml').status, 1);
  assert.equal(run(dir, '--message', 'm', '--', '.claude/skills/x/SKILL.md').status, 1);
});

test('Scenario: Lock file without permission - refused; with --allow it is committed', () => {
  const dir = repo({ 'pubspec.lock': 'a\n' });
  put(dir, 'pubspec.lock', 'b\n');
  const refused = run(dir, '--message', 'chore: deps', '--', 'pubspec.lock');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /pubspec\.lock {2}dependency file: the issue must list it in an Allow-paths: line/);
  assert.deepEqual(staged(dir), []);
  const ok = run(dir, '--message', 'chore: deps', '--allow', 'pubspec.yaml,pubspec.lock', '--', 'pubspec.lock');
  assert.equal(ok.status, 0, ok.stderr);
});

test('a protected file inside a folder that was named is found after staging', () => {
  const dir = repo();
  put(dir, 'apps/web/src/main.js', 'x\n');
  put(dir, 'apps/web/package.json', '{}\n');
  const r = run(dir, '--message', 'feat: web', '--', 'apps');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /apps\/web\/package\.json/);
  assert.deepEqual(staged(dir), [], 'the whole named folder is unstaged');
});

test('the project rules file from relevo.yml is never changed', () => {
  const dir = repo({ 'relevo.yml': 'limits:\n  run_max_cost: 5\nqa:\n  rules_from: docs/rules.md\n', 'docs/rules.md': 'rule\n' });
  put(dir, 'docs/rules.md', 'rule changed to fit\n');
  const r = run(dir, '--message', 'fix: rules', '--', 'docs/rules.md');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /docs\/rules\.md {2}protected path/);
  assert.equal(run(dir, '--message', 'fix: rules', '--rules-file', 'other.md', '--', 'docs/rules.md').status, 0, 'a rules file given by hand replaces the one of the configuration');
});

test('files staged for another reason stay staged and are not committed', () => {
  const dir = repo();
  put(dir, 'lib/a.dart', 'a\n');
  put(dir, 'notes.txt', 'mine\n');
  git(dir, 'add', 'notes.txt');
  assert.equal(run(dir, '--message', 'feat: a', '--', 'lib/a.dart').status, 0);
  assert.deepEqual(git(dir, 'show', '--name-only', '--format=', 'HEAD').trim().split('\n'), ['lib/a.dart']);
  assert.deepEqual(staged(dir), ['notes.txt']);
});

test('a refusal unstages only the named paths', () => {
  const dir = repo();
  put(dir, 'lib/a.dart', `// ${TEMP}\n`);
  put(dir, 'notes.txt', 'mine\n');
  git(dir, 'add', 'notes.txt');
  assert.equal(run(dir, '--message', 'feat: a', '--', 'lib/a.dart').status, 1);
  assert.deepEqual(staged(dir), ['notes.txt']);
});

test('staging everything is refused: "." and "-A" exit 2', () => {
  const dir = repo();
  put(dir, 'lib/a.dart', 'a\n');
  assert.equal(run(dir, '--message', 'm', '--', '.').status, 2);
  const all = run(dir, '--message', 'm', '--', '-A');
  assert.equal(all.status, 2);
  assert.match(all.stderr, /refusing to stage/);
  assert.deepEqual(staged(dir), []);
});

test('bad arguments exit 2: no message, no paths, nothing to commit', () => {
  const dir = repo();
  assert.equal(run(dir, '--', 'lib/a.dart').status, 2);
  assert.equal(run(dir, '--message', 'm').status, 2);
  assert.match(run(dir, '--message', 'm').stderr, /usage: commit-change\.mjs/);
  const none = run(dir, '--message', 'm', '--', 'README.md');
  assert.equal(none.status, 2);
  assert.match(none.stderr, /nothing to commit/);
});
