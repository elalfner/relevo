import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../scripts/restricted-check.mjs', import.meta.url).pathname;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(join(dir, path, '..'), { recursive: true });
  writeFileSync(join(dir, path), text);
};
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-restricted-'));
  git(dir, 'init', '-q', '-b', 'dev');
  git(dir, 'config', 'user.email', 'a@b');
  git(dir, 'config', 'user.name', 't');
  Object.entries(files).forEach(([path, text]) => put(dir, path, text));
  git(dir, 'add', '-f', '.');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}
const run = (cwd, ...args) => spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });

test('Scenario: A restricted file that is already versioned - the check fails and names the path, never its content', () => {
  const dir = repo({ 'README.md': 'x\n', '.env': 'API_KEY=not-a-real-value\n', 'api/.env.production': 'A=1\n', '.env.example': 'API_KEY=\n' });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^\.env {2}restricted file in the diff/m);
  assert.match(r.stderr, /^api\/\.env\.production {2}restricted file in the diff/m);
  assert.ok(!/\.env\.example {2}/.test(r.stderr), 'the example file is not reported');
  assert.ok(!r.stderr.includes('not-a-real-value') && !r.stdout.includes('not-a-real-value'));
});

test('Scenario: Nothing versioned - a repository without a restricted file passes', () => {
  const dir = repo({ 'README.md': 'x\n', '.env.example': 'API_KEY=\n', 'lib/a.dart': 'void a() {}\n' });
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no restricted file is versioned/);
});

test('--ref checks the files of a commit, and an entry of restricted_paths in relevo.yml counts', () => {
  const dir = repo({ 'relevo.yml': 'limits:\n  run_max_cost: 5\nrestricted_paths:\n  - infra/prod.tfvars\n', 'infra/prod.tfvars': 'x = 1\n' });
  const r = run(dir, '--ref', 'dev');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /infra\/prod\.tfvars {2}restricted file in the diff/);
  const clean = repo({ 'README.md': 'x\n' });
  put(clean, '.env', 'A=1\n');
  assert.equal(run(clean, '--ref', 'dev').status, 0, 'an untracked .env is not versioned');
  assert.equal(run(clean, '--ref', 'nope').status, 2, 'a ref git does not know is an error');
});
