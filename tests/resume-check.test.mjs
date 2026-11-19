import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../scripts/resume-check.mjs', import.meta.url));
const HASH = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};

/** A remote with `dev`, and a branch `feature/7-x` made of the given commits: [subject, hash or null, file]. */
function remoteWith(commits) {
  const root = mkdtempSync(join(tmpdir(), 'relevo-resume-'));
  const origin = join(root, 'origin.git');
  const maker = join(root, 'maker');
  git(root, 'init', '-q', '--bare', '-b', 'dev', origin);
  mkdirSync(maker);
  git(maker, 'init', '-q', '-b', 'dev');
  git(maker, 'config', 'user.email', 'a@b');
  git(maker, 'config', 'user.name', 't');
  put(maker, 'README.md', 'base\n');
  git(maker, 'add', '.');
  git(maker, 'commit', '-qm', 'base');
  git(maker, 'remote', 'add', 'origin', origin);
  git(maker, 'push', '-q', 'origin', 'dev');
  if (commits) {
    git(maker, 'checkout', '-q', '-b', 'feature/7-x');
    commits.forEach(([subject, hash], i) => {
      put(maker, `file-${i}.txt`, `${i}\n`);
      git(maker, 'add', '.');
      git(maker, 'commit', '-qm', hash ? `${subject}\n\nIssue-hash: ${hash}` : subject);
    });
    git(maker, 'push', '-q', 'origin', 'feature/7-x');
  }
  // The run starts in a clone that has never seen the branch.
  const runner = join(root, 'runner');
  git(root, 'clone', '-q', '-b', 'dev', origin, runner);
  return runner;
}
const check = (runner, hash = HASH, issue = '7') => {
  const r = spawnSync(process.execPath, [CLI, 'dev', 'feature/7-x', issue, hash], { cwd: runner, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim());
};

const SPEC = ['docs: specification for #7', null];
const CP1 = ['wip: checkpoint 1/3 (#7)', HASH];
const CP2 = ['wip: checkpoint 2/3 (#7)', HASH];

test('Scenario: No branch on the remote - absent, the branch is created from the base', () => {
  assert.deepEqual(check(remoteWith(null)), { state: 'absent', reason: null });
});

test('Scenario: A run resumes - the specification and two checkpoints of this issue, with the same text', () => {
  const r = check(remoteWith([SPEC, CP1, CP2]));
  assert.equal(r.state, 'resume');
  assert.equal(r.commits, 3);
  assert.equal(r.checkpoints, 2);
  assert.match(r.tip, /^[0-9a-f]{7}$/);
});

test('the work kept at a limit can be resumed too, when it carries the hash', () => {
  assert.equal(check(remoteWith([SPEC, CP1, ['wip: stopped by limit (#7)', HASH]])).state, 'resume');
  assert.equal(check(remoteWith([SPEC, ['wip: stopped by limit (#7)', null]])).state, 'existing', 'no hash, not resumable');
});

test('Scenario: A person committed on the branch - existing, and the reason names the commit', () => {
  const r = check(remoteWith([SPEC, CP1, ['fix typo by hand', null], CP2]));
  assert.equal(r.state, 'existing');
  assert.match(r.reason, /not one of Relevo's.*fix typo by hand/);
});

test('Scenario: The issue text changed - existing', () => {
  const r = check(remoteWith([SPEC, CP1, CP2]), OTHER);
  assert.equal(r.state, 'existing');
  assert.match(r.reason, /text of the issue changed/);
  assert.equal(check(remoteWith([SPEC, CP1, CP2]), '').state, 'existing', 'the decision has no hash');
});

test('a tip with no hash, a tip that is only the specification, and a branch with no commit are not resumed', () => {
  assert.match(check(remoteWith([SPEC, CP1, ['wip: checkpoint 2/3 (#7)', null]])).reason, /carries no hash/);
  assert.match(check(remoteWith([SPEC])).reason, /tip of the branch is not a checkpoint/);
  assert.match(check(remoteWith([])).reason, /no commit over the base/);
});

test('Scenario: The work was rejected by QA - existing, the recovery is fix', () => {
  const r = check(remoteWith([SPEC, CP1, ['wip: rejected by QA (#7)', HASH]]));
  assert.equal(r.state, 'existing');
  assert.match(r.reason, /not one of Relevo's.*rejected by QA|tip of the branch is not a checkpoint/);
});

test('the commits of another issue, and the delivered feature commit, are not resumed', () => {
  assert.equal(check(remoteWith([['docs: specification for #8', null], ['wip: checkpoint 1/3 (#8)', HASH]])).state, 'existing');
  assert.equal(check(remoteWith([SPEC, CP1, ['feat: Screen (#7)', null]])).state, 'existing');
});

test('bad arguments exit 2', () => {
  const runner = remoteWith(null);
  assert.equal(spawnSync(process.execPath, [CLI, 'dev', 'feature/7-x'], { cwd: runner, encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [CLI, 'dev', 'feature/7-x', 'seven', HASH], { cwd: runner, encoding: 'utf8' }).status, 2);
});
