import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadConfig } from '../scripts/lib/config.mjs';
import { filesBackend } from '../scripts/lib/tracker/files.mjs';
import { shipDecisionFiles } from '../scripts/lib/ship-local.mjs';

const CLI = new URL('../scripts/ship-local.mjs', import.meta.url).pathname;
const YML = 'limits:\n  run_max_cost: 5\ntracker: files\ngit_provider: local\nbranches:\n  base: main\n';
const BODY = '## Summary\n\nA counter.\n\n## Scenarios\n\n- **WHEN** the user taps\n- **THEN** the counter goes up\n\n## Edge cases\n\n- at 99: shows 100\n\n## Out of scope\n\n- saving it\n';
const { config } = loadConfig(YML);

function project() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-ship-')));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  writeFileSync(join(dir, 'relevo.yml'), YML);
  writeFileSync(join(dir, 'app.txt'), 'base\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  const tracker = filesBackend({ repoRoot: dir });
  tracker.issueCreate({ title: 'Counter', body: BODY });
  git('add', '.relevo');
  git('commit', '-q', '-m', 'issue 1');
  tracker.stateSet(1, { add: ['relevo:ready'] });
  tracker.stateSet(1, { add: ['relevo:building'], remove: ['relevo:ready'] });
  git('switch', '-q', '-c', 'feature/1-counter');
  const put = (path, text, message) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); git('add', '.'); git('commit', '-q', '-m', message); };
  put('src/counter.txt', 'counter\n', 'feat: counter (#1)');
  const head = () => git('rev-parse', 'HEAD');
  tracker.stateSet(1, { add: ['relevo:built'], remove: ['relevo:building'] });
  git('switch', '-q', 'main');
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args, '--issue', '1'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: '/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin', GITHUB_REPOSITORY: '' } });
  const approve = (commit = git('rev-parse', 'feature/1-counter')) => tracker.deliverySet(1, { branch: 'feature/1-counter', base: 'main', review: { result: 'passed', commit }, gate: { status: 'green', commit } });
  return { dir, git, tracker, put, run, approve, head, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const facts = (extra = {}) => ({
  config, issue: { state: 'OPEN', labels: [{ name: 'relevo:built' }] },
  delivery: { review: { result: 'passed', commit: 'a' }, gate: { status: 'green', commit: 'a' } }, head: 'a',
  after: { review: [], gate: [] }, merge: { result: 'clean', files: [] }, ...extra,
});

test('the pure gate passes a reviewed, green, clean branch and names each reason that stops one', () => {
  assert.deepEqual(shipDecisionFiles(facts()), { ok: true, reasons: [] });
  assert.match(shipDecisionFiles(facts({ issue: { state: 'CLOSED', labels: [] } })).reasons[0], /already shipped/);
  assert.match(shipDecisionFiles(facts({ issue: { state: 'OPEN', labels: [{ name: 'relevo:ready' }] } })).reasons[0], /not been built/);
  assert.match(shipDecisionFiles(facts({ delivery: null })).reasons.join(), /not reviewed/);
  assert.match(shipDecisionFiles(facts({ delivery: { review: { result: 'failed' }, gate: { status: 'green', commit: 'a' } } })).reasons.join(), /not reviewed/);
  assert.match(shipDecisionFiles(facts({ after: { review: ['fix: x'], gate: [] } })).reasons.join(), /changed after the review/);
  assert.match(shipDecisionFiles(facts({ head: 'b', after: { review: [], gate: ['feat: more'] } })).reasons.join(), /has not passed on the commit that would be merged/);
  assert.match(shipDecisionFiles(facts({ merge: { result: 'conflict', files: ['app.txt'] } })).reasons.join(), /does not merge cleanly into main: app\.txt/);
  assert.match(shipDecisionFiles(facts({ merge: { result: 'unknown', files: [] } })).reasons.join(), /could not be checked/);
});

test('the archive commit that ship makes does not make the review or the gate stale', () => {
  const archive = 'chore(openspec): archive 1-counter (#1)';
  assert.equal(shipDecisionFiles(facts({ head: 'b', after: { review: [archive], gate: [archive] } })).ok, true);
});

test('Scenario: Confirmed - the base branch gains one commit, the branch is deleted and the issue has no Relevo state', () => {
  const p = project();
  p.approve();
  assert.equal(p.run('check').status, 0);
  const merged = p.run('merge', '--title', 'feat: counter (#1)');
  assert.equal(merged.status, 0, merged.stderr);
  assert.equal(p.git('rev-list', '--count', 'main'), '3', 'init, the issue and one squash commit');
  assert.equal(p.git('log', '-1', '--format=%s'), 'feat: counter (#1)');
  assert.match(p.git('log', '-1', '--format=%b'), /Issue #1/);
  assert.equal(existsSync(join(p.dir, 'src/counter.txt')), true);
  assert.equal(p.git('branch', '--list', 'feature/*'), '');
  const issue = p.tracker.issueGet(1);
  assert.equal(issue.state, 'CLOSED');
  assert.deepEqual(issue.labels, []);
  p.done();
});

test('Scenario: Not confirmed - check changes nothing, and merge is only the step after a yes', () => {
  const p = project();
  p.approve();
  const before = p.git('rev-parse', 'main');
  assert.equal(p.run('check').status, 0);
  assert.equal(p.git('rev-parse', 'main'), before);
  assert.equal(p.git('branch', '--list', 'feature/*').trim(), 'feature/1-counter');
  assert.equal(p.tracker.issueGet(1).state, 'OPEN');
  p.done();
});

test('Scenario: Conflict with the base - ship stops, lists the files and changes nothing', () => {
  const p = project();
  p.git('switch', '-q', 'feature/1-counter');
  p.put('app.txt', 'branch side\n', 'feat: touch app');
  p.git('switch', '-q', 'main');
  writeFileSync(join(p.dir, 'app.txt'), 'main side\n');
  p.git('commit', '-qam', 'main moved');
  p.approve();
  const before = p.git('rev-parse', 'main');
  const checked = p.run('check');
  assert.equal(checked.status, 1);
  assert.match(checked.stdout, /does not merge cleanly into main: app\.txt/);
  assert.equal(p.run('merge', '--title', 't').status, 1);
  assert.equal(p.git('rev-parse', 'main'), before);
  assert.equal(p.git('status', '--porcelain'), '');
  p.done();
});

test('Scenario: Gate not passed - commits after the last green gate stop ship', () => {
  const p = project();
  p.approve();
  p.git('switch', '-q', 'feature/1-counter');
  p.put('src/more.txt', 'more\n', 'feat: more');
  p.git('switch', '-q', 'main');
  const checked = p.run('check');
  assert.equal(checked.status, 1);
  assert.match(checked.stdout, /validation gate has not passed on the commit that would be merged/);
  assert.match(checked.stdout, /changed after the review/);
  p.done();
});

test('merge refuses off the base branch or with a dirty tree, and changes nothing', () => {
  const p = project();
  p.approve();
  writeFileSync(join(p.dir, 'mine.txt'), 'mine\n');
  const dirty = p.run('merge', '--title', 't');
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /working tree has changes/);
  rmSync(join(p.dir, 'mine.txt'));
  p.git('switch', '-q', 'feature/1-counter');
  assert.match(p.run('merge', '--title', 't').stderr, /check out main first/);
  assert.equal(p.tracker.issueGet(1).state, 'OPEN');
  p.done();
});

test('record-review stores the result on the commit reviewed, and record-gate needs a valid green receipt', () => {
  const p = project();
  assert.equal(p.run('record-review', '--result', 'passed').status, 0);
  const saved = p.tracker.deliveryRead(1);
  assert.equal(saved.review.result, 'passed');
  assert.equal(saved.review.commit, p.git('rev-parse', 'feature/1-counter'));
  assert.equal(p.run('record-review', '--result', 'maybe').status, 2);
  const gate = p.run('record-gate');
  assert.equal(gate.status, 1);
  assert.match(gate.stderr, /no valid green receipt/);
  assert.equal(p.run('check').status, 1);
  p.done();
});
