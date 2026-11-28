// The scripts a build uses, run for real on a files project whose repository has no remote: none may ask for `origin`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const S = (name) => new URL(`../scripts/${name}`, import.meta.url).pathname;
const YML = 'limits:\n  run_max_cost: 5\ntracker: files\ngit_provider: local\nbranches:\n  base: main\nplatforms:\n  web:\n    stack: vue\n    path: .\n    targets: [web]\n';
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-noremote-')));
const bin = join(scratch, 'bin');
mkdirSync(bin);
symlinkSync(process.execPath, join(bin, 'node'));
writeFileSync(join(bin, 'gh'), '#!/bin/sh\nexit 1\n');
chmodSync(join(bin, 'gh'), 0o755);
const env = { ...process.env, PATH: `${bin}:/usr/bin:/bin`, HOME: scratch, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
delete env.ANTIGRAVITY_AGENT;
delete env.ANTIGRAVITY_CONVERSATION_ID;
delete env.RELEVO_AGENT;

function project() {
  const dir = join(scratch, `p${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir);
  const run = (cmd, args) => spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', env });
  const git = (...a) => { const r = run('git', a); assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'relevo.yml'), YML);
  writeFileSync(join(dir, 'app.txt'), 'base\n');
  mkdirSync(join(dir, 'design'));
  writeFileSync(join(dir, 'design/home.png'), 'x');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  assert.equal(git('remote'), '');
  const script = (name, ...a) => run('node', [S(name), ...a]);
  const put = (path, text, message) => { mkdirSync(join(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), text); git('add', '.'); git('commit', '-q', '-m', message); };
  return { dir, git, script, put, run };
}

test('branch-state: a local branch is absent, spec-only or implementation, and the merge probe needs no fetch', () => {
  const p = project();
  assert.equal(p.script('branch-state.mjs', 'main', 'feature/1-x', '1-x').stdout.trim(), 'absent');
  p.git('switch', '-q', '-c', 'feature/1-x');
  p.put('openspec/changes/1-x/proposal.md', 'p\n', 'docs: spec');
  assert.equal(p.script('branch-state.mjs', 'main', 'feature/1-x', '1-x').stdout.trim(), 'spec-only');
  p.put('src/a.txt', 'a\n', 'feat: a');
  assert.equal(p.script('branch-state.mjs', 'main', 'feature/1-x', '1-x').stdout.trim(), 'implementation');
  assert.deepEqual(JSON.parse(p.script('branch-state.mjs', '--merge', 'main', 'feature/1-x').stdout), { result: 'clean', files: [] });
  rmSync(p.dir, { recursive: true });
});

test('branch-work: the current branch holds code beyond the specification, measured against the local base', () => {
  const p = project();
  p.git('switch', '-q', '-c', 'feature/1-x');
  p.put('openspec/changes/1-x/proposal.md', 'p\n', 'docs: spec');
  assert.equal(p.script('branch-work.mjs', '--base', 'main', '--change', '1-x').status, 1);
  p.put('src/a.txt', 'a\n', 'feat: a');
  const out = p.script('branch-work.mjs', '--base', 'main', '--change', '1-x');
  assert.equal(out.status, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout).implementation, true);
  rmSync(p.dir, { recursive: true });
});

test('integrate-base: unchanged when the base did not move, merged when it did, with nothing fetched', () => {
  const p = project();
  p.git('switch', '-q', '-c', 'feature/1-x');
  p.put('src/a.txt', 'a\n', 'feat: a');
  assert.equal(JSON.parse(p.script('integrate-base.mjs', '--base', 'main').stdout).outcome, 'unchanged');
  p.git('switch', '-q', 'main');
  p.put('other.txt', 'o\n', 'main moved');
  p.git('switch', '-q', 'feature/1-x');
  const merged = p.script('integrate-base.mjs', '--base', 'main');
  assert.equal(merged.status, 0, merged.stdout + merged.stderr);
  assert.equal(JSON.parse(merged.stdout).outcome, 'merged');
  assert.equal(p.git('status', '--porcelain'), '');
  rmSync(p.dir, { recursive: true });
});

test('resume-check and the checkpoint: a branch kept by a checkpoint resumes, a missing one is absent, and a changed text does not', () => {
  const p = project();
  const hash = 'a'.repeat(64);
  assert.equal(JSON.parse(p.script('resume-check.mjs', 'main', 'feature/1-x', '1', hash).stdout).state, 'absent');
  p.git('switch', '-q', '-c', 'feature/1-x');
  mkdirSync(join(p.dir, 'src'));
  writeFileSync(join(p.dir, 'src/a.txt'), 'a\n');
  const decision = Buffer.from(JSON.stringify({ issue: 1, branch: 'feature/1-x', base: 'main', change_id: '1-x', path: '.', allow_paths: [], issue_hash: hash })).toString('base64');
  const checkpoint = p.script('checkpoint.mjs', '--decision', decision, '--k', '1', '--of', '2');
  assert.equal(JSON.parse(checkpoint.stdout).state, 'not_pushed');
  const resumed = JSON.parse(p.script('resume-check.mjs', 'main', 'feature/1-x', '1', hash).stdout);
  assert.equal(resumed.state, 'resume', JSON.stringify(resumed));
  assert.equal(resumed.checkpoints, 1);
  assert.equal(JSON.parse(p.script('resume-check.mjs', 'main', 'feature/1-x', '1', 'b'.repeat(64)).stdout).state, 'existing');
  rmSync(p.dir, { recursive: true });
});

test('replica-plan template: the checkpoints over the local base are read', () => {
  const p = project();
  p.git('switch', '-q', '-c', 'feature/1-x');
  p.put('src/a.txt', 'a\n', 'wip: checkpoint 1/2 (#1)');
  const out = p.script('replica-plan.mjs', 'template', '--section', '1', '--issue', '1', '--base', 'main');
  assert.equal(out.status === 0 || out.status === 1, true, out.stderr);
  assert.doesNotMatch(out.stderr, /origin/);
  rmSync(p.dir, { recursive: true });
});

test('branch-worktree: a worktree holding a branch whose commits are all in the branch can be removed, because no remote is behind it', () => {
  const p = project();
  const wt = join(scratch, `wt${Math.random().toString(36).slice(2)}`);
  p.git('worktree', 'add', '-q', '-b', 'feature/1-x', wt);
  writeFileSync(join(wt, 'f.txt'), 'f\n');
  spawnSync('git', ['add', '.'], { cwd: wt, env });
  spawnSync('git', ['commit', '-q', '-m', 'feat: f'], { cwd: wt, env });
  const out = JSON.parse(p.script('branch-worktree.mjs', '--branch', 'feature/1-x', '--base', 'main', '--json').stdout);
  assert.equal(out.status, 1);
  assert.equal(out.removable, true, JSON.stringify(out.reasons));
  assert.equal(out.holds, 'implementation');
  writeFileSync(join(wt, 'dirty.txt'), 'd\n');
  const dirty = JSON.parse(p.script('branch-worktree.mjs', '--branch', 'feature/1-x', '--base', 'main', '--json').stdout);
  assert.equal(dirty.removable, false, 'an uncommitted change still stands in the way');
  p.git('worktree', 'remove', '--force', wt);
  rmSync(p.dir, { recursive: true });
});

test('build-preflight stage issue: a design file is looked for on the local base', () => {
  const p = project();
  writeFileSync(join(scratch, 'issue.md'), '## Summary\n\nx\n\n## Design reference\n\n- design/home.png: the hero\n');
  const out = p.script('build-preflight.mjs', '--stage', 'issue', '--issue-file', join(scratch, 'issue.md'), '--base', 'main');
  assert.doesNotMatch(out.stderr + out.stdout, /origin/);
  rmSync(p.dir, { recursive: true });
});

test('Scenario: a build can start with no remote - the worktree is made from the local base and holds relevo.yml and the issue files', () => {
  const p = project();
  mkdirSync(join(p.dir, '.relevo/issues'), { recursive: true });
  writeFileSync(join(p.dir, '.relevo/issues/1.md'), '# Counter\n\nbody\n');
  p.git('add', '.relevo');
  p.git('commit', '-q', '-m', 'issue 1');
  const baseSha = p.git('rev-parse', 'main');
  const dry = p.script('go-local.mjs', '1', '--dry-run');
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /\(from main\)/);
  const created = p.script('go-worktree.mjs', 'create', '1');
  assert.equal(created.status, 0, created.stderr);
  const info = JSON.parse(created.stdout);
  assert.equal(info.base, 'main');
  assert.equal(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: info.worktree, encoding: 'utf8', env }).stdout.trim(), baseSha);
  assert.equal(spawnSync('git', ['ls-files'], { cwd: info.worktree, encoding: 'utf8', env }).stdout.includes('relevo.yml'), true);
  assert.equal(spawnSync('git', ['ls-files'], { cwd: info.worktree, encoding: 'utf8', env }).stdout.includes('.relevo/issues/1.md'), true);
  // A script run from inside the worktree knows that this is a files project: it reads the local refs.
  assert.equal(spawnSync('node', [S('branch-state.mjs'), 'main', 'feature/1-x', '1-x'], { cwd: info.worktree, encoding: 'utf8', env }).stdout.trim(), 'absent');
  p.script('go-worktree.mjs', 'remove', '1');
  rmSync(p.dir, { recursive: true });
});
