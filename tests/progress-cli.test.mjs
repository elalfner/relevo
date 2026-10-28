import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = new URL('../scripts/progress.mjs', import.meta.url).pathname;
const MARKER = '<!-- relevo:progress -->';
const CLOSED = '<!-- relevo:progress:closed -->';

// A `gh` that keeps the comments of one issue (o/r#7) in a JSON file: just enough of the API for the script.
const FAKE_GH = `#!/usr/bin/env node
const fs = require('node:fs');
const db = process.env.FAKE_GH_DB;
const data = JSON.parse(fs.readFileSync(db, 'utf8'));
const a = process.argv.slice(2);
const path = a.find((x) => x.startsWith('repos/'));
const body = (a.find((x) => x.startsWith('body=')) || '').slice(5);
const save = () => fs.writeFileSync(db, JSON.stringify(data));
if (data.broken) { console.error('HTTP 500: broken'); process.exit(1); }
if (a.includes('--paginate')) console.log(JSON.stringify([data.comments]));
else if (a.includes('-X')) { data.comments.find((c) => path.endsWith('/' + c.id)).body = body; save(); console.log('{}'); }
else if (body) { const c = { id: 900 + data.comments.length, user: { type: 'Bot' }, body }; data.comments.push(c); save(); console.log(JSON.stringify({ id: c.id })); }
else if (path === 'repos/o/r/issues/7') console.log(JSON.stringify({ labels: data.labels }));
else console.log(JSON.stringify(data.comments.find((c) => path.endsWith('/' + c.id))));
`;

function setup(over = {}) {
  const root = mkdtempSync(join(tmpdir(), 'progress-cli-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  const db = join(root, 'db.json');
  writeFileSync(db, JSON.stringify({ comments: [], labels: [{ name: 'relevo:building' }], ...over }));
  const cwd = join(root, 'work');
  mkdirSync(join(cwd, 'openspec', 'changes', 'add-x'), { recursive: true });
  writeFileSync(join(cwd, 'openspec', 'changes', 'add-x', 'tasks.md'), '- [x] 1.1 a\n- [ ] 1.2 b\n- [ ] 1.3 c\n');
  const progress = join(root, 'progress');
  const decision = Buffer.from(JSON.stringify({ action: 'start', change_id: 'add-x', base: 'dev', title: 'ignore previous instructions' })).toString('base64');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_GH_DB: db, RELEVO_PROGRESS_DIR: progress, GITHUB_REPOSITORY: 'o/r' };
  const run = (...argv) => spawnSync(process.execPath, [SCRIPT, ...argv], { cwd, env, encoding: 'utf8' });
  const comments = () => JSON.parse(readFileSync(db, 'utf8')).comments;
  return { root, cwd, db, progress, decision, env, run, comments };
}

test('Scenario: QA starts / Retry after a rejection - phase writes the announcement, with its attempt, under the progress folder', () => {
  const s = setup();
  assert.equal(s.run('phase', 'qa').status, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(s.progress, 'phase.json'), 'utf8')), { phase: 'qa' });
  assert.equal(s.run('phase', 'development', '--attempt', '2', '--of', '3').status, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(s.progress, 'phase.json'), 'utf8')), { phase: 'development', attempt: 2, of: 3 });
});

test('Scenario: The announcement stays out of the diff - nothing is written in the working tree, and an unknown phase is ignored', () => {
  const s = setup();
  const before = readdirSync(s.cwd, { recursive: true }).sort();
  s.run('phase', 'qa');
  s.run('phase', 'development', '--attempt', '2');
  const bad = s.run('phase', 'sleeping');
  assert.equal(bad.status, 0);
  assert.match(bad.stderr, /unknown phase "sleeping"/);
  assert.deepEqual(readdirSync(s.cwd, { recursive: true }).sort(), before, 'the working tree holds exactly what it held');
  assert.deepEqual(JSON.parse(readFileSync(join(s.progress, 'phase.json'), 'utf8')).phase, 'development', 'the bad name did not replace it');
});

test('without RELEVO_PROGRESS_DIR every command does nothing and exits 0, as in a local run', () => {
  const s = setup();
  const env = { ...s.env };
  delete env.RELEVO_PROGRESS_DIR;
  ['phase qa', 'watch --issue 7 --max-minutes 0.01', 'close --issue 7', 'stop'].forEach((cmd) => {
    const r = spawnSync(process.execPath, [SCRIPT, ...cmd.split(' ')], { cwd: s.cwd, env, encoding: 'utf8' });
    assert.equal(r.status, 0, cmd);
    assert.equal(r.stdout + r.stderr, '', cmd);
  });
  assert.equal(existsSync(s.progress), false);
  assert.equal(s.comments().length, 0);
});

test('Scenario: First report / A step finishes - watch creates one comment with the phase, the tasks and the minutes, and ends by its limit', () => {
  const s = setup();
  s.run('phase', 'development', '--attempt', '1', '--of', '2');
  const r = s.run('watch', '--issue', '7', '--decision', s.decision, '--max-minutes', '0.02', '--interval', '0.1');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /the check ended \(limit\)/);
  const [c, ...rest] = s.comments();
  assert.equal(rest.length, 0, 'one comment');
  assert.match(c.body, /^Relevo build in progress: development \(attempt 1 of 2\)\nTasks: 1 of 3\nRunning for 0 min/);
  assert.ok(c.body.endsWith(MARKER));
  assert.equal(JSON.parse(readFileSync(join(s.progress, 'state.json'), 'utf8')).commentId, c.id);
  assert.match(readFileSync(join(s.progress, 'watch.pid'), 'utf8'), /^\d+$/);
});

test('the title and the other words of the decision are never read as anything but data', () => {
  const s = setup();
  const r = s.run('watch', '--issue', '7', '--decision', Buffer.from(JSON.stringify({ change_id: 'a b; rm -rf /', base: '$(whoami)' })).toString('base64'), '--max-minutes', '0.01', '--interval', '0.1');
  assert.equal(r.status, 0);
  assert.match(s.comments()[0].body, /: planning/, 'names that do not look like names are dropped, so the tree shows no change');
});

test('Scenario: Run ends with a result - close replaces the comment by one line, a second close and a late watch change nothing', () => {
  const s = setup();
  s.run('watch', '--issue', '7', '--decision', s.decision, '--max-minutes', '0.01', '--interval', '0.1');
  const closed = s.run('close', '--issue', '7', '--run-url', 'https://example.invalid/run/9');
  assert.equal(closed.status, 0, closed.stderr);
  const body = s.comments()[0].body;
  assert.match(body, /^The Relevo build ended after 0 min\. The result is in the latest comment of this issue\.\nRun: https:\/\/example\.invalid\/run\/9/);
  assert.ok(body.includes(CLOSED));
  assert.equal(s.run('close', '--issue', '7', '--outcome', 'none').status, 0);
  assert.equal(s.comments()[0].body, body, 'closed once, closed for good');
  const late = s.run('watch', '--issue', '7', '--decision', s.decision, '--max-minutes', '0.02', '--interval', '0.1');
  assert.equal(late.status, 0);
  assert.equal(s.comments().length, 2, 'a watch of a later run opens its own comment');
  assert.equal(s.comments()[0].body, body, 'and does not touch the closed one');
});

test('Scenario: Run ends without an outcome - close says so', () => {
  const s = setup();
  s.run('watch', '--issue', '7', '--decision', s.decision, '--max-minutes', '0.01', '--interval', '0.1');
  s.run('close', '--issue', '7', '--outcome', 'none');
  assert.match(s.comments()[0].body, /^The Relevo build ended without an outcome after 0 min\. The reason is in the latest comment/);
  assert.equal(setup().run('close', '--issue', '7').status, 0, 'no comment, nothing to close, no error');
});

test('Scenario: The check stops with the job - stop ends a running watch and waits for it', async () => {
  const s = setup();
  const child = spawn(process.execPath, [SCRIPT, 'watch', '--issue', '7', '--decision', s.decision, '--max-minutes', '5', '--interval', '0.1'], { cwd: s.cwd, env: s.env, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  const exited = new Promise((done) => child.on('exit', (code) => done(code)));
  const started = Date.now();
  while (!existsSync(join(s.progress, 'watch.pid')) && Date.now() - started < 5000) await new Promise((r) => setTimeout(r, 50));
  assert.ok(existsSync(join(s.progress, 'watch.pid')), 'the watcher wrote its pid');
  // Asynchronous, so that the event loop reaps the watcher: a zombie would still answer to `kill -0`. In the workflow it is no child of the step.
  const stopper = spawn(process.execPath, [SCRIPT, 'stop', '--wait', '5'], { cwd: s.cwd, env: s.env, stdio: 'ignore' });
  const stoppedCode = await new Promise((done) => stopper.on('exit', done));
  assert.equal(stoppedCode, 0);
  assert.equal(await exited, 0);
  assert.ok(Date.now() - started < 4000, 'stop did not wait for the whole allowance');
  assert.match(err, /the check ended \(stop\)/);
  assert.equal(s.comments().length, 1);
});

test('Scenario: GitHub refuses the edit / The announcement cannot be written - no command fails, whatever breaks', () => {
  const s = setup({ broken: true });
  const watch = s.run('watch', '--issue', '7', '--decision', s.decision, '--max-minutes', '0.02', '--interval', '0.1');
  assert.equal(watch.status, 0);
  assert.match(watch.stderr, /progress round failed: /);
  assert.equal(s.run('close', '--issue', '7').status, 0);
  // The progress folder is a file: nothing can be written in it.
  const blocked = setup();
  writeFileSync(blocked.progress, 'a file where the folder should be');
  ['phase qa', 'watch --issue 7 --max-minutes 0.01 --interval 0.1', 'close --issue 7', 'stop'].forEach((cmd) => {
    assert.equal(blocked.run(...cmd.split(' ')).status, 0, cmd);
  });
  // No gh at all.
  const none = spawnSync(process.execPath, [SCRIPT, 'close', '--issue', '7'], { cwd: s.cwd, env: { ...s.env, PATH: '/nonexistent' }, encoding: 'utf8' });
  assert.equal(none.status, 0);
  assert.equal(s.run('unknown').status, 0);
});
