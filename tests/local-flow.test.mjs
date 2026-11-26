// The scripts of a files project end to end on a repository with no remote, with a `gh` that fails (and leaves a mark) when it is called.
// The worktree of the build is made by the real script from the local base; only the work of the model is replaced by its commits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filesBackend } from '../scripts/lib/tracker/files.mjs';

const S = (name) => new URL(`../scripts/${name}`, import.meta.url).pathname;
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'relevo-flow-')));
const bin = join(scratch, 'bin');
const mark = join(scratch, 'gh-was-called');
mkdirSync(bin);
symlinkSync(process.execPath, join(bin, 'node'));
writeFileSync(join(bin, 'gh'), `#!/bin/sh\necho "$@" >> "${mark}"\nexit 1\n`);
chmodSync(join(bin, 'gh'), 0o755);
const dir = join(scratch, 'project');
mkdirSync(dir);
const env = {
  ...process.env, PATH: `${bin}:/usr/bin:/bin`, HOME: scratch, GITHUB_REPOSITORY: '', GH_TOKEN: '',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};
const runIn = (cwd, cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8', env });
const run = (cmd, args) => runIn(dir, cmd, args);
const node = (script, ...args) => run('node', [S(script), ...args]);
const nodeIn = (cwd, script, ...args) => runIn(cwd, 'node', [S(script), ...args]);
const git = (...a) => { const r = run('git', a); assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const BODY = '## Summary\n\nA counter.\n\n## Scenarios\n\n- **WHEN** the user taps\n- **THEN** the counter goes up\n\n## Edge cases\n\n- at 99: shows 100\n\n## Out of scope\n\n- saving it\n';

test('init, issue, approval, claim, checkpoint, review, status and ship, with no remote and no gh', () => {
  // init --local
  writeFileSync(join(scratch, 'answers.json'), JSON.stringify({ platforms: { web: { stack: 'vue', path: '.', targets: ['web'] } }, cost: 5, language: 'en' }));
  const init = node('init-local.mjs', 'apply', '--answers', join(scratch, 'answers.json'));
  assert.equal(init.status, 0, init.stdout + init.stderr);
  assert.equal(git('remote'), '', 'there is no remote');

  // /relevo:issue: the file, one commit of that file on the base branch, then ready
  writeFileSync(join(scratch, 'body.md'), BODY);
  const created = node('tracker.mjs', 'issue-create', '--title', 'Counter', '--body-file', join(scratch, 'body.md'));
  assert.equal(created.stdout.trim(), '.relevo/issues/1.md');
  git('add', '.relevo/issues/1.md');
  git('commit', '-q', '-m', 'issue #1: Counter', '--', '.relevo/issues/1.md');
  assert.equal(node('tracker.mjs', 'state-set', '1', '--add', 'relevo:ready').status, 0);

  // /relevo:go: plan and claim
  const claim = node('go-plan.mjs', '--place', 'local', '--only', '1', '--claim');
  assert.equal(claim.status, 0, claim.stderr);
  const decision = JSON.parse(claim.stdout).decisions[0];
  assert.equal(decision.action, 'start');
  assert.deepEqual(JSON.parse(node('tracker.mjs', 'issue-get', '1', '--fields', 'labels').stdout).labels.map((l) => l.name).sort(), ['relevo:building', 'relevo:local']);

  // the build: its worktree from the local base, then (standing in for the model) a branch and a checkpoint with no remote
  const build = JSON.parse(node('go-worktree.mjs', 'create', '1').stdout);
  const wt = build.worktree;
  assert.equal(runIn(wt, 'git', ['rev-parse', 'HEAD']).stdout.trim(), git('rev-parse', 'main'), 'made from the local base');
  assert.equal(runIn(wt, 'git', ['switch', '-q', '-c', decision.branch]).status, 0);
  mkdirSync(join(wt, 'src'));
  writeFileSync(join(wt, 'src/counter.txt'), 'counter\n');
  const checkpoint = nodeIn(wt, 'checkpoint.mjs', '--decision', Buffer.from(JSON.stringify({ issue: 1, branch: decision.branch, base: 'main', change_id: decision.change_id, path: '.', allow_paths: [], issue_hash: decision.issue_hash })).toString('base64'), '--k', '1', '--of', '1');
  assert.equal(checkpoint.status, 0, checkpoint.stderr);
  assert.equal(JSON.parse(checkpoint.stdout).state, 'not_pushed', 'no remote: the commit is made and kept');
  assert.match(runIn(wt, 'git', ['log', '-1', '--format=%s']).stdout, /^wip: checkpoint 1\/1 \(#1\)/);
  assert.equal(runIn(wt, 'git', ['status', '--porcelain']).stdout.trim(), '');
  assert.equal(nodeIn(wt, 'resume-check.mjs', 'main', decision.branch, '1', decision.issue_hash).stdout.includes('"resume"'), true, 'a cut run could resume from the checkpoint');
  const tracker = filesBackend({ repoRoot: dir });
  tracker.stateSet(1, { add: ['relevo:built'], remove: ['relevo:building', 'relevo:local'] });
  runIn(wt, 'git', ['switch', '-q', '--detach']);
  assert.equal(node('go-worktree.mjs', 'remove', '1').status, 0, 'a clean end of the build removes its worktree');
  assert.equal(existsSync(wt), false);

  // status, review, gate
  assert.match(node('status.mjs').stdout, /#1 Counter \[built\] -> \/relevo:review 1/);
  assert.equal(node('ship-local.mjs', 'record-review', '--issue', '1', '--result', 'passed').status, 0);
  tracker.deliverySet(1, { gate: { status: 'green', commit: git('rev-parse', decision.branch) } }); // the receipt of the gate is covered in ship-local.test.mjs
  assert.equal(node('ship-local.mjs', 'check', '--issue', '1').status, 0);

  // ship
  const merged = node('ship-local.mjs', 'merge', '--issue', '1', '--title', 'feat: counter (#1)');
  assert.equal(merged.status, 0, merged.stderr);
  assert.equal(git('rev-list', '--count', 'main'), '3', 'the setup, the issue and one squash commit');
  assert.equal(git('log', '-1', '--format=%s'), 'feat: counter (#1)');
  assert.equal(readFileSync(join(dir, 'src/counter.txt'), 'utf8'), 'counter\n');
  assert.equal(git('branch', '--list', 'feature/*'), '');
  assert.equal(tracker.issueGet(1).state, 'CLOSED');
  assert.deepEqual(tracker.issueGet(1).labels, []);
  assert.match(node('status.mjs').stdout, /Nothing is waiting/);

  assert.equal(existsSync(mark), false, `gh was called: ${existsSync(mark) ? readFileSync(mark, 'utf8') : ''}`);
  rmSync(scratch, { recursive: true, force: true });
});
