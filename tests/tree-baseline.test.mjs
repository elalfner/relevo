import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedSince, fingerprint, loadBaseline, saveBaseline, takeBaseline } from '../scripts/lib/tree-baseline.mjs';
import { readDecision, rescueWork } from '../scripts/lib/rescue-work.mjs';

const CLI = fileURLToPath(new URL('../scripts/tree-baseline.mjs', import.meta.url));
const RESCUE_CLI = fileURLToPath(new URL('../scripts/rescue-work.mjs', import.meta.url));
const sh = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (dir, path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};
const b64 = (d) => Buffer.from(JSON.stringify(d)).toString('base64');
const DECISION = { issue: 7, branch: 'feature/7-x', base: 'dev', change_id: '7-x', path: '.', allow_paths: [] };

/** A clone on the branch of the issue whose lockfile was rewritten by an install step before the agent started. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'relevo-baseline-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  sh(root, 'init', '-q', '--bare', '-b', 'dev', origin);
  mkdirSync(work);
  sh(work, 'init', '-q', '-b', 'dev');
  sh(work, 'config', 'user.email', 'a@b');
  sh(work, 'config', 'user.name', 't');
  put(work, 'README.md', 'base\n');
  put(work, 'pubspec.lock', 'locked: 1\n');
  sh(work, 'add', '.');
  sh(work, 'commit', '-qm', 'base');
  sh(work, 'remote', 'add', 'origin', origin);
  sh(work, 'push', '-q', 'origin', 'dev');
  sh(work, 'checkout', '-q', '-b', 'feature/7-x');
  put(work, 'pubspec.lock', 'locked: 2 (rewritten by the install step)\n');
  const git = (args) => sh(work, ...args);
  return { root, origin, work, git };
}

test('takeBaseline records the files that already differ, with a fingerprint of their content', () => {
  const f = fixture();
  put(f.work, 'untracked.txt', 'x\n');
  const baseline = takeBaseline(f.git);
  assert.deepEqual(Object.keys(baseline).sort(), ['pubspec.lock', 'untracked.txt']);
  assert.equal(baseline['pubspec.lock'], fingerprint(f.git, 'pubspec.lock'));
});

test('a restricted file is never opened and has no fingerprint', () => {
  const f = fixture();
  put(f.work, '.env', 'SECRET=1\n');
  assert.equal(fingerprint(f.git, '.env'), null);
  assert.equal('.env' in takeBaseline(f.git), false);
  assert.deepEqual(changedSince(['.env'], { '.env': 'abc' }, f.git), ['.env'], 'it is never left out');
});

test('changedSince leaves out a file whose content is still the recorded one, and keeps the others', () => {
  const f = fixture();
  const baseline = takeBaseline(f.git);
  put(f.work, 'src/a.js', 'a\n');
  assert.deepEqual(changedSince(['pubspec.lock', 'src/a.js'], baseline, f.git), ['src/a.js']);
  put(f.work, 'pubspec.lock', 'locked: 3 (changed again by the agent)\n');
  assert.deepEqual(changedSince(['pubspec.lock', 'src/a.js'], baseline, f.git), ['pubspec.lock', 'src/a.js'], 'a file the agent changed again stays in');
  assert.deepEqual(changedSince(['pubspec.lock'], {}, f.git), ['pubspec.lock'], 'without a baseline everything stays in');
});

test('saveBaseline and loadBaseline round-trip, and anything unreadable gives an empty baseline', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relevo-baseline-dir-'));
  assert.deepEqual(loadBaseline(dir), {}, 'nothing saved');
  assert.equal(saveBaseline(dir, { 'a.txt': 'abc', 'b.txt': 'def' }), true);
  assert.deepEqual(loadBaseline(dir), { 'a.txt': 'abc', 'b.txt': 'def' });
  writeFileSync(join(dir, 'tree-baseline.json'), '{not json');
  assert.deepEqual(loadBaseline(dir), {});
  writeFileSync(join(dir, 'tree-baseline.json'), JSON.stringify({ 'a.txt': 5, 'b.txt': 'ok' }));
  assert.deepEqual(loadBaseline(dir), { 'b.txt': 'ok' }, 'only string fingerprints are kept');
  assert.equal(saveBaseline(null, {}), false);
  assert.deepEqual(loadBaseline(null), {});
});

test('Scenario: the install step rewrote a lockfile - without the baseline the rescue refuses the real work with it', () => {
  const f = fixture();
  put(f.work, 'src/a.js', 'export const a = 1;\n');
  const out = rescueWork({ git: f.git, decision: readDecision(b64(DECISION)) });
  assert.equal(out.state, 'unsafe');
  assert.match(out.detail, /pubspec\.lock/);
});

test('Scenario: the install step rewrote a lockfile - with the baseline only the work of the agent is kept', () => {
  const f = fixture();
  const baseline = takeBaseline(f.git);
  put(f.work, 'src/a.js', 'export const a = 1;\n');
  const out = rescueWork({ git: f.git, decision: readDecision(b64(DECISION)), baseline });
  assert.equal(out.state, 'kept');
  assert.equal(out.files, 1);
  assert.deepEqual(sh(f.origin, 'show', '--name-only', '--format=', 'feature/7-x').trim().split('\n'), ['src/a.js']);
  assert.match(sh(f.work, 'status', '--short'), /pubspec\.lock/, 'the lockfile stays in the working tree, uncommitted');
});

test('Scenario: the agent changed the lockfile again - it is judged like any change', () => {
  const f = fixture();
  const baseline = takeBaseline(f.git);
  put(f.work, 'pubspec.lock', 'locked: 9 (the agent added a dependency)\n');
  put(f.work, 'src/a.js', 'export const a = 1;\n');
  const out = rescueWork({ git: f.git, decision: readDecision(b64(DECISION)), baseline });
  assert.equal(out.state, 'unsafe', 'the issue did not list the dependency file');
  const listed = rescueWork({ git: f.git, decision: readDecision(b64({ ...DECISION, allow_paths: ['pubspec.lock'] })), baseline });
  assert.equal(listed.state, 'kept');
  assert.equal(listed.files, 2);
});

test('Scenario: nothing but the install step changed the tree - there is nothing to keep', () => {
  const f = fixture();
  const baseline = takeBaseline(f.git);
  const out = rescueWork({ git: f.git, decision: readDecision(b64(DECISION)), baseline });
  assert.equal(out.state, 'nothing');
  assert.equal(out.branch, 'feature/7-x');
});

test('the run on the base branch with only the install step changes keeps nothing and creates no branch', () => {
  const f = fixture();
  sh(f.work, 'checkout', '-q', 'dev');
  sh(f.work, 'branch', '-q', '-D', 'feature/7-x');
  put(f.work, 'pubspec.lock', 'locked: 2 (rewritten by the install step)\n');
  const baseline = takeBaseline(f.git);
  const out = rescueWork({ git: f.git, decision: readDecision(b64(DECISION)), baseline });
  assert.equal(out.state, 'nothing');
  assert.equal(sh(f.work, 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'dev');
});

test('the commands: record writes the baseline and rescue-work reads it, and both exit 0', () => {
  const f = fixture();
  const progress = mkdtempSync(join(tmpdir(), 'relevo-baseline-progress-'));
  const env = { ...process.env, RELEVO_PROGRESS_DIR: progress, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 'a@b', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 'a@b' };
  const recorded = spawnSync(process.execPath, [CLI, 'record'], { cwd: f.work, encoding: 'utf8', env });
  assert.equal(recorded.status, 0);
  assert.deepEqual(JSON.parse(recorded.stdout), { recorded: 1 });
  assert.equal(existsSync(join(progress, 'tree-baseline.json')), true);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(progress, 'tree-baseline.json'), 'utf8'))), ['pubspec.lock']);
  put(f.work, 'src/a.js', 'export const a = 1;\n');
  const rescued = spawnSync(process.execPath, [RESCUE_CLI, '--decision', b64(DECISION)], { cwd: f.work, encoding: 'utf8', env });
  assert.equal(rescued.status, 0);
  assert.equal(JSON.parse(rescued.stdout).state, 'kept');
});

test('record without a progress folder does nothing, and a bad command only complains', () => {
  const f = fixture();
  const env = { ...process.env, RELEVO_PROGRESS_DIR: '' };
  const none = spawnSync(process.execPath, [CLI, 'record'], { cwd: f.work, encoding: 'utf8', env });
  assert.equal(none.status, 0);
  assert.equal(none.stdout, '');
  const bad = spawnSync(process.execPath, [CLI, 'wander'], { cwd: f.work, encoding: 'utf8', env });
  assert.equal(bad.status, 0);
  assert.match(bad.stderr, /use `record`/);
});

test('Scenario: list prints the files still as the install step left them, and only those', () => {
  const f = fixture();
  const progress = mkdtempSync(join(tmpdir(), 'relevo-baseline-list-'));
  const env = { ...process.env, RELEVO_PROGRESS_DIR: progress };
  put(f.work, 'analysis_options.yaml', 'include: a\n');
  sh(f.work, 'add', 'analysis_options.yaml');
  sh(f.work, 'commit', '-qm', 'config');
  put(f.work, 'analysis_options.yaml', 'include: a\n# rewritten by the install step\n');
  assert.equal(spawnSync(process.execPath, [CLI, 'record'], { cwd: f.work, encoding: 'utf8', env }).status, 0);
  put(f.work, 'src/a.js', 'export const a = 1;\n');
  const run = (extra = env) => spawnSync(process.execPath, [CLI, 'list'], { cwd: f.work, encoding: 'utf8', env: extra });
  assert.deepEqual(run().stdout.trim().split('\n').sort(), ['analysis_options.yaml', 'pubspec.lock'], 'the new file of the developer is not in the list');
  put(f.work, 'pubspec.lock', 'locked: 9 (changed by the developer)\n');
  assert.deepEqual(run().stdout.trim().split('\n'), ['analysis_options.yaml'], 'a file changed after the install is part of the change');
  const local = run({ ...process.env, RELEVO_PROGRESS_DIR: '' });
  assert.equal(local.status, 0);
  assert.equal(local.stdout, '', 'a local run has no record: nothing is left out');
});
