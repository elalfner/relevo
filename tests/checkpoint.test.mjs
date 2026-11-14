import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../scripts/checkpoint.mjs', import.meta.url));
const MARKER = ['NO', 'COMMIT'].join(''); // built here so that this file does not trip the scan it tests
const HASH = 'd'.repeat(64);
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};
const b64 = (d) => Buffer.from(JSON.stringify(d)).toString('base64');
const DECISION = { issue: 7, branch: 'feature/7-x', base: 'dev', change_id: '7-x', path: '.', allow_paths: [], issue_hash: HASH };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'relevo-checkpoint-'));
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
  return { origin, work };
}
const checkpoint = (f, k, n, decision = DECISION) => {
  const r = spawnSync(process.execPath, [CLI, '--decision', b64(decision), '--k', String(k), '--of', String(n)], { cwd: f.work, encoding: 'utf8' });
  return { code: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout.trim().split('\n').pop()) : null, err: r.stderr };
};
const remoteSubjects = (f) => git(f.origin, 'log', '--format=%s', 'dev..feature/7-x').trim().split('\n').filter(Boolean);

test('Scenario: A group finishes - its files are committed as a checkpoint with the hash of the issue, and the branch is pushed', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'export const a = 1;\n');
  put(f.work, 'openspec/changes/7-x/tasks.md', '- [x] 1.1 a\n');
  const { code, out } = checkpoint(f, 1, 3);
  assert.equal(code, 0);
  assert.equal(out.state, 'kept');
  assert.equal(out.files, 2);
  assert.deepEqual(remoteSubjects(f), ['wip: checkpoint 1/3 (#7)']);
  assert.match(git(f.origin, 'log', '-1', '--format=%B', 'feature/7-x'), new RegExp(`Issue-hash: ${HASH}`));
});

test('Scenario: A cut after a checkpoint - the second checkpoint goes on top of the first, as a fast-forward', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'one\n');
  checkpoint(f, 1, 3);
  put(f.work, 'src/b.js', 'two\n');
  const second = checkpoint(f, 2, 3);
  assert.equal(second.out.state, 'kept');
  assert.deepEqual(remoteSubjects(f), ['wip: checkpoint 2/3 (#7)', 'wip: checkpoint 1/3 (#7)']);
  assert.equal(git(f.origin, 'rev-parse', 'feature/7-x').trim(), git(f.work, 'rev-parse', 'HEAD').trim());
});

test('a group that changed nothing makes no commit', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'one\n');
  checkpoint(f, 1, 2);
  const again = checkpoint(f, 2, 2);
  assert.equal(again.code, 0);
  assert.deepEqual(remoteSubjects(f), ['wip: checkpoint 1/2 (#7)'], 'no second commit');
});

test('Scenario: The scans refuse a checkpoint - exit 1, nothing is pushed and the file is named', () => {
  const f = fixture();
  put(f.work, 'src/b.js', `export const b = 2; // ${MARKER}\n`);
  const { code, out } = checkpoint(f, 1, 2);
  assert.equal(code, 1);
  assert.equal(out.state, 'unsafe');
  assert.match(out.detail, /src\/b\.js/);
  assert.throws(() => git(f.origin, 'rev-parse', '--verify', '-q', 'refs/heads/feature/7-x'), 'the branch was not pushed');
});

test('the arguments are checked: k and of are positive whole numbers with k <= of, and the decision must be readable', () => {
  const f = fixture();
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: f.work, encoding: 'utf8' }).status;
  assert.equal(run('--decision', b64(DECISION), '--k', '0', '--of', '3'), 2);
  assert.equal(run('--decision', b64(DECISION), '--k', '4', '--of', '3'), 2);
  assert.equal(run('--decision', b64(DECISION), '--k', 'x', '--of', '3'), 2);
  assert.equal(run('--decision', 'garbage', '--k', '1', '--of', '3'), 2);
});

test('Scenario: A replica touches a protected path - its checkpoint is refused like any other, and the template checkpoint stays', () => {
  const f = fixture();
  put(f.work, 'src/orders.js', 'export const orders = 1;\n');
  assert.equal(checkpoint(f, 1, 3).code, 0);
  // Group 2 is a replica: the cheaper model also wrote a workflow, which no unattended run may change.
  put(f.work, 'src/invoices.js', 'export const invoices = 1;\n');
  put(f.work, '.github/workflows/replica.yml', 'name: x\n');
  const { code, out } = checkpoint(f, 2, 3);
  assert.equal(code, 1);
  assert.equal(out.state, 'unsafe');
  assert.match(out.detail, /\.github\/workflows\/replica\.yml/);
  assert.deepEqual(remoteSubjects(f), ['wip: checkpoint 1/3 (#7)']);
});

test('a replica that leaks a credential is refused too', () => {
  const f = fixture();
  put(f.work, 'src/invoices.js', `export const key = '${['AK', 'IA'].join('')}ABCDEFGHIJKLMNOP';\n`);
  const { code, out } = checkpoint(f, 2, 3);
  assert.equal(code, 1);
  assert.equal(out.state, 'unsafe');
});
