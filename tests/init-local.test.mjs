import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { planLocalInit, renderLocalConfig } from '../scripts/lib/init-local.mjs';

const CLI = new URL('../scripts/init-local.mjs', import.meta.url).pathname;
const ANSWERS = { platforms: { web: { stack: 'vue', path: '.', targets: ['web'] } }, cost: 5, language: 'es' };
const folder = () => realpathSync(mkdtempSync(join(tmpdir(), 'relevo-initlocal-')));
// The identity and the global git config of the test are in the environment: nothing of the person's git configuration is read or written.
// A PATH with only `node` (linked here) and the system folders: nothing installed globally with npm (openspec) or by a package manager (gh) is found.
const bin = join(realpathSync(mkdtempSync(join(tmpdir(), 'relevo-bin-'))), 'bin');
mkdirSync(bin);
symlinkSync(process.execPath, join(bin, 'node'));
const IDENTITY = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
// No `gh` on the PATH: a setup that needed it would fail here.
const env = { ...process.env, ...IDENTITY, PATH: `${bin}:/usr/bin:/bin`, HOME: tmpdir(), GITHUB_REPOSITORY: '', GH_TOKEN: '' };
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (dir, mode, ...extra) => spawnSync(process.execPath, [CLI, mode, ...extra], { cwd: dir, encoding: 'utf8', env });
const withAnswers = (dir, answers = ANSWERS) => { const f = join(dir, '..', `${dir.split('/').pop()}-answers.json`); writeFileSync(f, JSON.stringify(answers)); return f; };
const FACTS = { isRepo: false, hasCommit: false, branch: null, configText: null, config: null, issuesKeep: false, gitignoreText: null, openspec: '1.0', openspecRoot: true, skills: { 'openspec-explore': true, 'grill-with-docs': true, grilling: true, 'domain-modeling': true } };

test('the config of a local project is valid and says files, local and prototype', () => {
  const text = renderLocalConfig({ base: 'main', cost: 5, language: 'en', platforms: ANSWERS.platforms });
  const { ok, config, errors } = loadConfig(text);
  assert.equal(ok, true, JSON.stringify(errors));
  assert.deepEqual([config.tracker, config.git_provider, config.depth, config.review.mode, config.branches.base], ['files', 'local', 'prototype', 'none', 'main']);
});

test('Scenario: Empty folder - the plan lists the repository, relevo.yml and .relevo/issues/, and nothing about GitHub', () => {
  const plan = planLocalInit({ facts: FACTS, answers: ANSWERS });
  assert.deepEqual(plan.items.filter((i) => i.status === 'todo').map((i) => i.id), ['git.init', 'config.write', 'issues.dir', 'gitignore.evidence', 'git.commit']);
  assert.equal(plan.items.some((i) => /label|workflow|ruleset|secret|github|remote/i.test(`${i.id} ${i.description}`)), false, 'no GitHub item');
});

test('the plan asks for what it lacks: the platform and the cost, and nothing else', () => {
  const plan = planLocalInit({ facts: FACTS, answers: {} });
  assert.deepEqual(plan.questions, ['platforms', 'cost']);
  assert.equal(plan.items.some((i) => i.id === 'config.write' && i.status === 'todo'), false);
});

test('apply on an empty folder makes the repository on main, relevo.yml, .relevo/issues/ and the first commit, with no gh', () => {
  const dir = folder();
  const answers = withAnswers(dir);
  const plan = run(dir, 'plan', '--answers', answers);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /\[will do\] Create the git repository/);
  assert.equal(existsSync(join(dir, 'relevo.yml')), false, 'plan changes nothing');
  const applied = run(dir, 'apply', '--answers', answers);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  assert.equal(git(dir, 'branch', '--show-current'), 'main');
  const { ok, config } = loadConfig(readFileSync(join(dir, 'relevo.yml'), 'utf8'));
  assert.equal(ok, true);
  assert.equal(config.tracker, 'files');
  assert.equal(config.language, 'es');
  assert.equal(existsSync(join(dir, '.relevo/issues/.gitkeep')), true);
  assert.match(readFileSync(join(dir, '.gitignore'), 'utf8'), /^evidence\/$/m);
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'chore: set up Relevo');
  assert.deepEqual(git(dir, 'ls-files').split('\n').sort(), ['.gitignore', '.relevo/issues/.gitkeep', 'relevo.yml']);
  rmSync(dir, { recursive: true, force: true });
});

test('Scenario: Second run - nothing of init itself is left to do, and no commit is made', () => {
  const dir = folder();
  const answers = withAnswers(dir);
  run(dir, 'apply', '--answers', answers);
  const again = JSON.parse(run(dir, 'plan', '--answers', answers, '--json').stdout);
  assert.deepEqual(again.items.filter((i) => i.status === 'todo' && !i.install), [], 'only installs, which the skill asks about, may remain');
  const head = git(dir, 'rev-parse', 'HEAD');
  run(dir, 'apply', '--answers', answers);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), head, 'applying again makes no commit');
  rmSync(dir, { recursive: true, force: true });
});

test('in a repository that already has commits the base is the current branch and nothing of the person is committed', () => {
  const dir = folder();
  git(dir, 'init', '-q', '-b', 'trunk');
  writeFileSync(join(dir, 'a.txt'), 'x\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'first');
  const head = git(dir, 'rev-parse', 'HEAD');
  const applied = run(dir, 'apply', '--answers', withAnswers(dir));
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(loadConfig(readFileSync(join(dir, 'relevo.yml'), 'utf8')).config.branches.base, 'trunk');
  assert.equal(git(dir, 'rev-parse', 'HEAD'), head, 'it commits nothing of yours');
  assert.match(git(dir, 'status', '--porcelain'), /relevo\.yml/);
  rmSync(dir, { recursive: true, force: true });
});

test('a GitHub project is left alone', () => {
  const dir = folder();
  writeFileSync(join(dir, 'relevo.yml'), 'limits:\n  run_max_cost: 5\n');
  const out = run(dir, 'apply', '--answers', withAnswers(dir));
  assert.equal(out.status, 1);
  assert.match(out.stdout, /changes nothing/);
  assert.equal(readFileSync(join(dir, 'relevo.yml'), 'utf8'), 'limits:\n  run_max_cost: 5\n');
  assert.equal(existsSync(join(dir, '.git')), false);
  rmSync(dir, { recursive: true, force: true });
});

test('without the answers the CLI says what is missing and writes nothing', () => {
  const dir = folder();
  const out = run(dir, 'apply');
  assert.equal(out.status, 1);
  assert.match(out.stdout, /Needs answers: platforms, cost/);
  assert.equal(existsSync(join(dir, 'relevo.yml')), false);
  rmSync(dir, { recursive: true, force: true });
});
