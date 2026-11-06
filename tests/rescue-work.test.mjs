import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedPaths, readDecision, rescueWork } from '../scripts/lib/rescue-work.mjs';

const CLI = fileURLToPath(new URL('../scripts/rescue-work.mjs', import.meta.url));
// The marker is built here so that this file does not trip the scan it tests.
const MARKER = ['NO', 'COMMIT'].join('');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};
const b64 = (d) => Buffer.from(JSON.stringify(d)).toString('base64');
const DECISION = { issue: 7, branch: 'feature/7-x', base: 'dev', change_id: '7-x', path: '.', allow_paths: [] };

/** A working clone on the branch of the issue, with a bare origin that has only the base branch. */
function fixture({ identity = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'relevo-rescue-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  git(root, 'init', '-q', '--bare', '-b', 'dev', origin);
  mkdirSync(work);
  git(work, 'init', '-q', '-b', 'dev');
  git(work, 'config', 'user.email', 'a@b');
  git(work, 'config', 'user.name', 't');
  put(work, 'README.md', 'base\n');
  git(work, 'add', '.');
  git(work, 'commit', '-qm', 'base');
  git(work, 'remote', 'add', 'origin', origin);
  git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', '-b', 'feature/7-x');
  if (!identity) {
    git(work, 'config', '--unset', 'user.email');
    git(work, 'config', '--unset', 'user.name');
  }
  return { root, origin, work };
}
const remoteBranch = (f, branch = 'feature/7-x') => git(f.origin, 'rev-parse', '--verify', '-q', `refs/heads/${branch}`).trim();
const hasRemoteBranch = (f, branch = 'feature/7-x') => spawnSync('git', ['rev-parse', '--verify', '-q', `refs/heads/${branch}`], { cwd: f.origin }).status === 0;
function rescue(f, { decision = DECISION, args = [], env = {} } = {}) {
  const r = spawnSync(process.execPath, [CLI, '--decision', b64(decision), ...args], { cwd: f.work, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(r.status, 0, `the rescue never fails: ${r.stderr}`);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

test('changedPaths reads the status of git, keeps both paths of a rename and leaves out what is not the work', () => {
  const z = [' M src/a.js', '?? src/new file.js', 'R  src/b.js', 'src/old.js', '?? .relevo-receipt/receipt.json', '?? node_modules/x/index.js', ' D gone.txt', ''].join('\0');
  assert.deepEqual(changedPaths(z), ['src/a.js', 'src/new file.js', 'src/b.js', 'src/old.js', 'gone.txt']);
  assert.deepEqual(changedPaths(''), []);
});

test('readDecision reads only numbers and names, and nothing else', () => {
  assert.deepEqual(readDecision(b64(DECISION)), { issue: 7, branch: 'feature/7-x', base: 'dev', change: '7-x', within: '.', allow: [], issueHash: null });
  assert.equal(readDecision(b64({ ...DECISION, issue_hash: 'a'.repeat(64) })).issueHash, 'a'.repeat(64));
  assert.equal(readDecision(b64({ ...DECISION, issue_hash: 'not a hash' })).issueHash, null, 'only a sha-256 is read');
  assert.equal(readDecision(b64({ ...DECISION, issue: -1 })), null);
  assert.equal(readDecision(b64({ ...DECISION, branch: 'a b' })), null);
  assert.equal(readDecision(b64({ ...DECISION, branch: '../x' })), null);
  assert.equal(readDecision('not base64 json'), null);
  assert.equal(readDecision(undefined), null);
  assert.deepEqual(readDecision(b64({ ...DECISION, allow_paths: ['package.json', '--all', 5] })).allow, ['package.json']);
});

test('Scenario: The job is cut and the run recorded no outcome - the changes are committed and pushed to the branch of the issue', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'export const a = 1;\n');
  put(f.work, 'openspec/changes/7-x/tasks.md', '- [x] 1.1 do it\n');
  put(f.work, '.relevo-receipt/receipt.json', '{}'); // not the work
  const out = rescue(f);
  assert.equal(out.state, 'kept');
  assert.equal(out.files, 2);
  assert.match(out.commit, /^[0-9a-f]{7,}$/);
  assert.equal(git(f.work, 'log', '-1', '--format=%s').trim(), 'wip: stopped by limit (#7)');
  assert.equal(remoteBranch(f), git(f.work, 'rev-parse', 'HEAD').trim(), 'the remote has the commit');
  assert.deepEqual(git(f.origin, 'show', '--name-only', '--format=', 'feature/7-x').trim().split('\n').sort(), ['openspec/changes/7-x/tasks.md', 'src/a.js']);
});

test('Scenario: Nothing changed - no commit, nothing pushed', () => {
  const f = fixture();
  const out = rescue(f);
  assert.equal(out.state, 'nothing');
  assert.match(out.detail, /nothing to keep/);
  assert.equal(hasRemoteBranch(f), false);
});

test('commits of the branch that were never pushed are pushed, with no new commit', () => {
  const f = fixture();
  put(f.work, 'openspec/changes/7-x/proposal.md', 'p\n');
  git(f.work, 'add', '.');
  git(f.work, 'commit', '-qm', 'docs: specification for #7');
  const out = rescue(f);
  assert.equal(out.state, 'kept');
  assert.equal(out.commit, null);
  assert.equal(remoteBranch(f), git(f.work, 'rev-parse', 'HEAD').trim());
});

test('Scenario: The scans refuse the rescue commit - nothing is pushed and the refusal names the file', () => {
  const protectedPath = fixture();
  put(protectedPath.work, '.github/workflows/x.yml', 'on: push\n');
  const a = rescue(protectedPath);
  assert.equal(a.state, 'unsafe');
  assert.match(a.detail, /\.github\/workflows\/x\.yml/);
  assert.equal(hasRemoteBranch(protectedPath), false);

  const marker = fixture();
  put(marker.work, 'src/b.js', `export const b = 2; // ${MARKER}\n`);
  const b = rescue(marker);
  assert.equal(b.state, 'unsafe');
  assert.match(b.detail, /src\/b\.js/);
  assert.equal(hasRemoteBranch(marker), false);
  assert.equal(git(marker.work, 'log', '-1', '--format=%s').trim(), 'base', 'no commit was made');

  const restricted = fixture();
  put(restricted.work, '.env.production', 'KEY=1\n');
  const c = rescue(restricted);
  assert.equal(c.state, 'unsafe');
  assert.doesNotMatch(JSON.stringify(c), /KEY=1/, 'the content of a restricted file is never printed');
  assert.equal(hasRemoteBranch(restricted), false);
});

test('Scenario: The remote holds the checkpoints of this run - the push is a fast-forward and the work is kept', () => {
  const f = fixture();
  put(f.work, 'src/early.js', 'x\n');
  git(f.work, 'add', '.');
  git(f.work, 'commit', '-qm', 'wip: checkpoint 1/2 (#7)');
  git(f.work, 'push', '-q', 'origin', 'feature/7-x');
  put(f.work, 'src/late.js', 'y\n');
  const out = rescue(f);
  assert.equal(out.state, 'kept', out.detail);
  assert.equal(remoteBranch(f), git(f.work, 'rev-parse', 'HEAD').trim());
  assert.equal(git(f.origin, 'log', '--format=%s', '-3', 'feature/7-x').trim().split('\n')[0], 'wip: stopped by limit (#7)');
});

test('Scenario: The branch already exists on the remote with commits this run does not have - it is not touched', () => {
  const f = fixture();
  // Someone else created the branch from the base and pushed a commit of their own.
  const other = join(f.root, 'other');
  git(f.root, 'clone', '-q', f.origin, other);
  git(other, 'config', 'user.email', 'p@q');
  git(other, 'config', 'user.name', 'p');
  git(other, 'checkout', '-q', '-b', 'feature/7-x');
  put(other, 'theirs.txt', 'their work\n');
  git(other, 'add', '.');
  git(other, 'commit', '-qm', 'their work');
  git(other, 'push', '-q', 'origin', 'feature/7-x');
  const before = remoteBranch(f);
  put(f.work, 'src/late.js', 'y\n');
  const out = rescue(f);
  assert.equal(out.state, 'existing');
  assert.equal(remoteBranch(f), before, 'the remote branch is as it was');
  assert.equal(git(f.work, 'log', '-1', '--format=%s').trim(), 'base', 'no commit was made');
});

test('the commit carries the hash of the issue text as a trailer when the decision has it, and a given subject replaces the default', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'x\n');
  const hash = 'c'.repeat(64);
  const out = rescueWork({ git: (args) => git(f.work, ...args), decision: readDecision(b64({ ...DECISION, issue_hash: hash })), subject: 'wip: checkpoint 1/3 (#7)' });
  assert.equal(out.state, 'kept');
  assert.equal(git(f.work, 'log', '-1', '--format=%s').trim(), 'wip: checkpoint 1/3 (#7)');
  assert.match(git(f.work, 'log', '-1', '--format=%B'), new RegExp(`\\nIssue-hash: ${hash}\\n`));
});

test('Scenario: The run never moved to the branch of the issue - the edits are kept on it and the base branch is not touched', () => {
  const f = fixture();
  git(f.work, 'checkout', '-q', 'dev');
  git(f.work, 'branch', '-q', '-D', 'feature/7-x');
  const devTip = git(f.work, 'rev-parse', 'dev').trim();
  put(f.work, 'src/a.js', 'x\n');
  put(f.work, 'src/b.js', 'y\n');
  const out = rescue(f);
  assert.equal(out.state, 'kept');
  assert.equal(out.files, 2);
  assert.equal(git(f.work, 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'feature/7-x');
  assert.equal(git(f.work, 'rev-parse', 'dev').trim(), devTip, 'the base branch has no new commit');
  assert.equal(hasRemoteBranch(f), true);
  assert.equal(git(f.origin, 'rev-parse', 'refs/heads/dev').trim(), devTip, 'the base branch on the remote is the same');
  assert.equal(git(f.work, 'log', '-1', '--format=%s').trim(), 'wip: stopped by limit (#7)');
});

test('Scenario: The run is on some other branch - the edits are kept on a separate rescue branch and nothing of the issue is touched', () => {
  const f = fixture();
  git(f.work, 'checkout', '-q', '-b', 'other/branch');
  put(f.work, 'src/a.js', 'x\n');
  put(f.work, 'src/b.js', 'y\n');
  const issueTip = git(f.work, 'rev-parse', 'feature/7-x').trim();
  const out = rescue(f);
  assert.equal(out.state, 'kept');
  assert.equal(out.branch, 'rescue/feature/7-x');
  assert.equal(out.files, 2);
  assert.equal(hasRemoteBranch(f, 'rescue/feature/7-x'), true);
  assert.equal(hasRemoteBranch(f), false, 'the branch of the issue is not created on the remote');
  assert.equal(git(f.work, 'rev-parse', 'feature/7-x').trim(), issueTip);
  assert.equal(git(f.origin, 'rev-parse', 'refs/heads/dev').trim(), git(f.work, 'rev-parse', 'dev').trim());
});

test('the branch of the issue exists here but the run is on the base - the edits go to the rescue branch, the base is not touched', () => {
  const f = fixture();
  git(f.work, 'checkout', '-q', 'dev');
  put(f.work, 'src/a.js', 'x\n');
  const devTip = git(f.work, 'rev-parse', 'dev').trim();
  const out = rescue(f);
  assert.equal(out.state, 'kept');
  assert.equal(out.branch, 'rescue/feature/7-x');
  assert.equal(git(f.work, 'rev-parse', 'dev').trim(), devTip);
  assert.equal(hasRemoteBranch(f, 'rescue/feature/7-x'), true);
});

test('a rescue branch that already exists here is not reused - the failure is reported', () => {
  const f = fixture();
  git(f.work, 'branch', 'rescue/feature/7-x');
  git(f.work, 'checkout', '-q', 'dev');
  put(f.work, 'src/a.js', 'x\n');
  const out = rescue(f);
  assert.equal(out.state, 'not_pushed');
  assert.match(out.detail, /could not be created/);
});

test('the run is on the base with no edits - there is no work of the issue to keep', () => {
  const f = fixture();
  git(f.work, 'checkout', '-q', 'dev');
  git(f.work, 'branch', '-q', '-D', 'feature/7-x');
  const out = rescue(f);
  assert.equal(out.state, 'nothing');
  assert.match(out.detail, /was not created/);
  assert.equal(hasRemoteBranch(f), false);
});

test('a push that fails is reported, and the commit stays on the local branch', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'x\n');
  const real = (args) => git(f.work, ...args);
  const failing = (args) => {
    if (args[0] === 'push') throw Object.assign(new Error('boom'), { stderr: 'remote: permission denied\n' });
    return real(args);
  };
  const out = rescueWork({ git: failing, decision: readDecision(b64(DECISION)) });
  assert.equal(out.state, 'not_pushed');
  assert.match(out.detail, /the push failed: remote: permission denied/);
  assert.equal(git(f.work, 'log', '-1', '--format=%s').trim(), 'wip: stopped by limit (#7)');
  assert.equal(hasRemoteBranch(f), false);
});

test('no force is ever used', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'x\n');
  const seen = [];
  rescueWork({ git: (args) => { seen.push(args); return git(f.work, ...args); }, decision: readDecision(b64(DECISION)) });
  assert.ok(seen.some((a) => a[0] === 'push'));
  seen.filter((a) => a[0] === 'push').forEach((a) => assert.ok(!a.some((x) => /^(-f|--force.*)$/.test(x)), 'no force'));
});

test('a repository with no identity of its own is committed under the identity of the workflow', () => {
  const f = fixture({ identity: false });
  put(f.work, 'src/a.js', 'x\n');
  const out = rescue(f, { env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', HOME: f.root } });
  assert.equal(out.state, 'kept', out.detail);
  assert.equal(git(f.work, 'log', '-1', '--format=%an').trim(), 'github-actions[bot]');
});

test('the result goes to the output file of the step, on one line each', () => {
  const f = fixture();
  put(f.work, '.github/workflows/x.yml', 'on: push\n');
  const outFile = join(f.root, 'github-output');
  writeFileSync(outFile, '');
  rescue(f, { args: ['--github-output', outFile] });
  const lines = readFileSync(outFile, 'utf8').trim().split('\n');
  assert.deepEqual(lines.map((l) => l.split('=')[0]), ['state', 'branch', 'detail']);
  assert.equal(lines[0], 'state=unsafe');
  assert.equal(lines[1], 'branch=feature/7-x');
});

test('an unreadable decision keeps nothing and still exits 0', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'x\n');
  const r = spawnSync(process.execPath, [CLI, '--decision', 'garbage'], { cwd: f.work, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).state, 'nothing');
  assert.equal(hasRemoteBranch(f), false);
});
