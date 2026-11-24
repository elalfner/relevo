import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localChecks } from '../scripts/lib/doctor-local.mjs';

const CLI = new URL('../scripts/doctor.mjs', import.meta.url).pathname;
const YML = 'limits:\n  run_max_cost: 5\ntracker: files\ngit_provider: local\nbranches:\n  base: main\nplatforms:\n  web:\n    stack: vue\n    path: .\n    targets: [web]\n';
// A PATH with only `node` (linked here) and the system folders: nothing installed globally with npm (openspec) or by a package manager (gh) is found.
const bin = join(realpathSync(mkdtempSync(join(tmpdir(), 'relevo-bin-'))), 'bin');
mkdirSync(bin);
symlinkSync(process.execPath, join(bin, 'node'));
const IDENTITY = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
// `gh` and `openspec` are not on this PATH: the doctor of a local project must not need the first, and must fail on the second.
const env = { ...process.env, ...IDENTITY, PATH: `${bin}:/usr/bin:/bin`, HOME: tmpdir(), GITHUB_REPOSITORY: '', GH_TOKEN: '' };
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const project = ({ commit = true, issues = true } = {}) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-doctor-')));
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'relevo.yml'), YML);
  if (issues) { mkdirSync(join(dir, '.relevo/issues'), { recursive: true }); writeFileSync(join(dir, '.relevo/issues/.gitkeep'), ''); }
  if (commit) { git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'init'); }
  return dir;
};
const doctor = (dir) => {
  const r = spawnSync(process.execPath, [CLI, '--json'], { cwd: dir, encoding: 'utf8', env });
  return { status: r.status, results: JSON.parse(r.stdout) };
};

test('Scenario: No remote - a files project with no remote has no failure and no warning about GitHub, labels, rulesets, secrets, workflows or the remote', () => {
  const dir = project();
  const { results } = doctor(dir);
  const bad = results.filter((r) => r.status === 'fail' || r.status === 'warn');
  assert.deepEqual(bad.filter((r) => /^(repo\.(?!local|base)|automation|tools\.gh|execution|ship|links|web|plugin|labels)/.test(r.id)), []);
  assert.equal(results.some((r) => /^(repo\.protection|repo\.labels|automation\.|tools\.gh)/.test(r.id)), false, 'those checks are not even reported');
  assert.equal(results.find((r) => r.id === 'repo.local').status, 'pass');
  assert.equal(results.find((r) => r.id === 'repo.base-branch').status, 'pass');
  assert.equal(results.find((r) => r.id === 'issues.dir').status, 'pass');
  assert.equal(results.find((r) => r.id === 'config.valid').status, 'pass');
  rmSync(dir, { recursive: true, force: true });
});

test('Scenario: Missing tool - OpenSpec not installed fails with the fix next to it, as for a GitHub project', () => {
  const dir = project();
  const { status, results } = doctor(dir);
  const openspec = results.find((r) => r.id === 'tools.openspec');
  assert.equal(openspec.status, 'fail');
  assert.match(openspec.fix, /@fission-ai\/openspec/);
  assert.equal(status, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('a base branch with no commit fails and says how to fix it; a missing issues folder only warns', () => {
  const dir = project({ commit: false, issues: false });
  const { results } = doctor(dir);
  assert.equal(results.find((r) => r.id === 'repo.base-branch').status, 'fail');
  assert.match(results.find((r) => r.id === 'repo.base-branch').fix, /first commit/);
  assert.equal(results.find((r) => r.id === 'issues.dir').status, 'warn');
  rmSync(dir, { recursive: true, force: true });
});

test('a folder that is not a git repository fails once and does not run the base branch check', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-doctor-')));
  writeFileSync(join(dir, 'relevo.yml'), YML);
  const { results } = doctor(dir);
  assert.equal(results.find((r) => r.id === 'repo.local').status, 'fail');
  assert.equal(results.some((r) => r.id === 'repo.base-branch'), false);
  rmSync(dir, { recursive: true, force: true });
});

test('localChecks keeps what applies and drops what is about GitHub', () => {
  const all = ['tools.gh', 'tools.gh-auth', 'repo.protection', 'repo.labels', 'automation.secret', 'ship.app', 'tools.git', 'config.valid', 'skills.grilling', 'platform.web.profile']
    .map((id) => ({ id, status: 'fail', message: id }));
  const kept = localChecks(all, { isRepo: true, base: 'main', baseHasCommit: true, issuesDir: true }).map((r) => r.id);
  assert.deepEqual(kept.filter((id) => !['repo.local', 'repo.base-branch', 'config.committed', 'issues.dir'].includes(id)), ['tools.git', 'config.valid', 'skills.grilling', 'platform.web.profile']);
});

test('Scenario: a relevo.yml that is not committed on the base branch fails, because a build would not find it', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-doctor-')));
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'other.txt'), 'x\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  writeFileSync(join(dir, 'relevo.yml'), YML);
  const { results } = doctor(dir);
  const found = results.find((r) => r.id === 'config.committed');
  assert.equal(found.status, 'fail');
  assert.match(found.fix, /git add relevo\.yml/);
  git(dir, 'add', 'relevo.yml');
  git(dir, 'commit', '-q', '-m', 'config');
  assert.equal(doctor(dir).results.find((r) => r.id === 'config.committed').status, 'pass');
  rmSync(dir, { recursive: true, force: true });
});
