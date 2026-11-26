import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resumeState } from '../scripts/lib/resume-check.mjs';
import { restGit } from '../scripts/lib/resume-rest.mjs';

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

// The adapter answers the two `git` calls of `resumeState` from the REST API, so the `decide` job (no checkout) can ask the same check.
// Parity: the same commits give the same answer through a fake `git` and through the adapter.
const NO_HASH = null;
const fakeGit = (commits) => (args) => {
  if (args[0] === 'rev-parse') return '';
  // newest first, as `git log` prints them
  return commits.map(([subject, hash], i) => `sha${i}\x1f${subject}\x1f${hash ? `Issue-hash: ${hash}` : ''}\x1e`).reverse().join('');
};
const restOf = (commits, { missing = false, fail = false, total = null } = {}) => (args) => {
  const path = args[1];
  if (fail) throw new Error('HTTP 500');
  if (path.includes('/git/ref/heads/')) {
    if (missing) throw new Error('HTTP 404: Not Found');
    return JSON.stringify({ ref: 'refs/heads/feature/7-x' });
  }
  if (path.includes('/compare/')) {
    const list = commits.map(([subject, hash], i) => ({ sha: `sha${i}`, commit: { message: hash ? `${subject}\n\nIssue-hash: ${hash}` : subject } }));
    return JSON.stringify({ total_commits: total ?? list.length, commits: list });
  }
  throw new Error(`unexpected call ${args.join(' ')}`);
};
const through = (commits, opts, hash = HASH) => resumeState({ git: restGit({ gh: restOf(commits, opts), repo: 'o/r' }), base: 'dev', branch: 'feature/7-x', issue: 7, issueHash: hash });
const direct = (commits, hash = HASH) => resumeState({ git: fakeGit(commits), base: 'dev', branch: 'feature/7-x', issue: 7, issueHash: hash });

test('the adapter gives the same state and reason as git for a limit tip, a checkpoint tip, a rejection, a foreign commit and a changed hash', () => {
  const LIMIT = ['wip: stopped by limit (#7)', HASH];
  const cases = [
    [[SPEC, CP1, LIMIT], HASH],
    [[SPEC, CP1, CP2], HASH],
    [[SPEC, CP1, ['wip: rejected by QA (#7)', HASH]], HASH],
    [[SPEC, CP1, ['fix typo by hand', NO_HASH], CP2], HASH],
    [[SPEC, CP1, CP2], OTHER],
    [[SPEC, ['wip: stopped by limit (#7)', NO_HASH]], HASH],
    [[SPEC], HASH],
  ];
  for (const [commits, hash] of cases) assert.deepEqual(through(commits, {}, hash), direct(commits, hash), JSON.stringify(commits));
  assert.equal(through([SPEC, CP1, LIMIT]).state, 'resume');
});

test('the adapter: no branch is absent, and a branch that cannot be read is existing with the reason, never resume', () => {
  assert.deepEqual(through([SPEC, CP1], { missing: true }), { state: 'absent', reason: null });
  const failed = through([SPEC, CP1], { fail: true });
  assert.equal(failed.state, 'existing');
  assert.match(failed.reason, /could not read the branch|HTTP 500/);
});

test('the adapter refuses a branch with more commits than the comparison returned, instead of judging a part of it', () => {
  const r = through([SPEC, CP1, CP2], { total: 400 });
  assert.equal(r.state, 'existing');
  assert.match(r.reason, /could not read the branch/);
});

test('the adapter only accepts plain branch and base names, as the check does', () => {
  const git = restGit({ gh: restOf([SPEC]), repo: 'o/r' });
  assert.throws(() => git(['log', '--format=%H', 'origin/dev..origin/feature/7-x; rm']));
});
