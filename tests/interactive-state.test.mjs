import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSnapshot } from '../scripts/lib/build-state.mjs';

const root = new URL('../', import.meta.url).pathname;
const script = (name) => `${root}scripts/${name}`;
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const clean = (env = {}) => ({ ...process.env, RELEVO_PROGRESS_DIR: '', ...env });

// A repository with a remote, as `go-worktree.mjs create` needs, and a relevo.yml from the template.
function repo() {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-is-')));
  const origin = join(parent, 'origin.git');
  const work = join(parent, 'shop');
  git(parent, 'init', '-q', '--bare', '-b', 'dev', origin);
  mkdirSync(work);
  git(work, 'init', '-q', '-b', 'dev');
  git(work, 'config', 'user.email', 'a@b');
  git(work, 'config', 'user.name', 't');
  writeFileSync(join(work, 'README.md'), 'x\n');
  writeFileSync(join(work, 'relevo.yml'), readFileSync(`${root}templates/relevo.yml`, 'utf8'));
  git(work, 'add', '.');
  git(work, 'commit', '-qm', 'base');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', 'origin', 'dev');
  return { parent, work };
}

test('Scenario: Progress of an interactive build - the scripts find the state folder from the worktree, with no variable', () => {
  const { parent, work } = repo();
  const made = spawnSync(process.execPath, [script('go-worktree.mjs'), 'create', '42'], { cwd: work, encoding: 'utf8', env: clean() });
  assert.equal(made.status, 0, made.stderr);
  const { worktree, state } = JSON.parse(made.stdout);
  assert.equal(state, join(parent, '.relevo-worktrees', '.state', 'shop-42'));
  assert.ok(existsSync(join(state, 'build.json')));
  // the scripts of the skill, run inside the worktree with no RELEVO_PROGRESS_DIR
  const run = (name, ...args) => spawnSync(process.execPath, [script(name), ...args], { cwd: worktree, encoding: 'utf8', env: clean() });
  assert.equal(run('progress.mjs', 'phase', 'development').status, 0);
  assert.equal(run('progress.mjs', 'change', '42-x').status, 0);
  assert.equal(run('run-budget.mjs', 'record', '--agent', 'relevo:dev', '--tool-uses', '4').status, 0);
  mkdirSync(join(worktree, 'openspec', 'changes', '42-x'), { recursive: true });
  writeFileSync(join(worktree, 'openspec', 'changes', '42-x', 'tasks.md'), '- [x] 1.1 a\n- [ ] 1.2 b\n');
  const snapshot = buildSnapshot({ dir: state, worktree, git: (a) => git(worktree, ...a), now: Date.now() });
  assert.equal(snapshot.phase.phase, 'development');
  assert.deepEqual(snapshot.tasks, { done: 1, total: 2 });
  assert.equal(snapshot.agents.length, 1);
  // go-local.mjs status, from another terminal (the main working tree)
  const status = spawnSync(process.execPath, [script('go-local.mjs'), 'status', '42'], { cwd: work, encoding: 'utf8', env: clean() });
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /development · tasks 1 of 2/);
});

test('Scenario: Guard in a session - the budget guard reads numbers from the folder found from the worktree', () => {
  const { work } = repo();
  const made = JSON.parse(spawnSync(process.execPath, [script('go-worktree.mjs'), 'create', '43'], { cwd: work, encoding: 'utf8', env: clean() }).stdout);
  const run = (...args) => spawnSync(process.execPath, [script('run-budget.mjs'), ...args], { cwd: made.worktree, encoding: 'utf8', env: clean() });
  run('record', '--agent', 'relevo:dev', '--tool-uses', '30');
  const check = run('check', '--max-turns', '20', '--max-minutes', '50');
  const out = JSON.parse(check.stdout.trim().split('\n').pop());
  assert.equal(out.known, true);
  assert.equal(out.stop, true);
  assert.equal(out.reason, 'turns');
  assert.equal(check.status, 1);
});

test('a second create replaces the state of the first build of the issue', () => {
  const { work, parent } = repo();
  const first = JSON.parse(spawnSync(process.execPath, [script('go-worktree.mjs'), 'create', '44'], { cwd: work, encoding: 'utf8', env: clean() }).stdout);
  writeFileSync(join(first.state, 'leftover'), 'x');
  spawnSync(process.execPath, [script('go-worktree.mjs'), 'remove', '44'], { cwd: work, encoding: 'utf8', env: clean() });
  assert.ok(existsSync(join(first.state, 'leftover')), 'the state stays when the worktree goes');
  spawnSync(process.execPath, [script('go-worktree.mjs'), 'create', '44'], { cwd: work, encoding: 'utf8', env: clean() });
  assert.ok(!existsSync(join(first.state, 'leftover')));
  assert.ok(existsSync(join(parent, '.relevo-worktrees', '.state', 'shop-44', 'build.json')));
});
