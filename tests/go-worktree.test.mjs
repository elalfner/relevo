import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../scripts/lib/config.mjs';
import { planLocalRun } from '../scripts/lib/go-local.mjs';
import { createWorktree, EXIT, removeWorktree } from '../scripts/lib/go-worktree.mjs';
import { worktreePath } from '../scripts/lib/worktree-path.mjs';

const root = new URL('../', import.meta.url).pathname;
const { config } = loadConfig(readFileSync(`${root}templates/relevo.yml`, 'utf8'));
const REPO = '/home/me/code/shop';
const WORKTREE = '/home/me/code/.relevo-worktrees/shop-42';

/** A fake runner: records every call; `linked` makes the git dir differ from the common one; `fail` maps "cmd arg0 arg1" to an error. */
function fakeRunner({ linked = false, fail = {} } = {}) {
  const calls = [];
  return {
    calls,
    capture(cmd, args, options) {
      calls.push({ cmd, args, cwd: options.cwd });
      const key = `${cmd} ${args.slice(0, 2).join(' ')}`;
      if (key in fail) throw Object.assign(new Error(fail[key].message ?? 'failed'), fail[key]);
      if (cmd === 'git' && args.includes('--show-toplevel')) return `${REPO}\n`;
      if (cmd === 'git' && args.includes('--git-dir')) {
        return linked ? `${REPO}/.git/worktrees/shop-42\n${REPO}/.git\n` : `${REPO}/.git\n${REPO}/.git\n`;
      }
      return '';
    },
  };
}
const gitCalls = (runner) => runner.calls.filter((c) => c.cmd === 'git').map((c) => c.args.join(' '));

test('Scenario: Two issues at once - each issue gets its own worktree from the base branch', () => {
  const one = createWorktree({ issue: '1', config, runner: fakeRunner() });
  const two = createWorktree({ issue: '2', config, runner: fakeRunner() });
  assert.equal(one.status, EXIT.ok);
  assert.equal(two.status, EXIT.ok);
  assert.equal(one.worktree, '/home/me/code/.relevo-worktrees/shop-1');
  assert.equal(two.worktree, '/home/me/code/.relevo-worktrees/shop-2');
  assert.notEqual(one.worktree, two.worktree);
});

test('create fetches the base branch and adds a detached worktree outside the repository', () => {
  const runner = fakeRunner();
  const r = createWorktree({ issue: '42', config, runner });
  assert.equal(r.status, EXIT.ok);
  assert.equal(r.worktree, WORKTREE);
  assert.equal(r.base, 'dev');
  assert.ok(!r.worktree.startsWith(`${REPO}/`));
  const git = gitCalls(runner);
  assert.ok(git.includes('fetch origin dev'));
  assert.ok(git.includes(`worktree add --detach ${WORKTREE} origin/dev`));
  assert.ok(git.indexOf('fetch origin dev') < git.indexOf(`worktree add --detach ${WORKTREE} origin/dev`));
});

test('Scenario: Uncommitted changes in the main working tree - create does not look at them', () => {
  const runner = fakeRunner();
  createWorktree({ issue: '42', config, runner });
  assert.ok(!gitCalls(runner).some((a) => a.startsWith('status') || a.startsWith('stash') || a.startsWith('switch') || a.startsWith('checkout')));
});

test('Scenario: The same issue twice - it stops before any change, names the worktree and the command that removes it', () => {
  const runner = fakeRunner();
  const r = createWorktree({ issue: '42', config, runner, exists: (p) => p === WORKTREE });
  assert.equal(r.status, EXIT.exists);
  assert.equal(r.worktree, WORKTREE);
  assert.ok(r.messages[0].includes(WORKTREE));
  assert.ok(r.messages[0].includes(`git worktree remove --force "${WORKTREE}"`));
  assert.ok(!gitCalls(runner).some((a) => a.startsWith('fetch') || a.startsWith('worktree add') || a.startsWith('worktree prune')));
});

test('Scenario: No worktree where one exists - in a linked worktree create answers "linked" and changes nothing', () => {
  const runner = fakeRunner({ linked: true });
  const r = createWorktree({ issue: '42', config, runner });
  assert.equal(r.status, EXIT.linked);
  assert.equal(r.worktree, null);
  assert.ok(!gitCalls(runner).some((a) => a.startsWith('fetch') || a.startsWith('worktree add')));
});

test('a base branch that is not on the remote is a failure that names the cause', () => {
  const runner = fakeRunner({ fail: { 'git fetch origin': { stderr: "fatal: couldn't find remote ref dev\nmore" } } });
  const r = createWorktree({ issue: '42', config, runner });
  assert.equal(r.status, EXIT.failed);
  assert.ok(r.messages[0].startsWith('could not prepare the worktree: fatal: couldn\'t find remote ref dev'));
  assert.ok(!r.messages[0].includes('more'));
});

test('the cause of a failed worktree add is the fatal line, not the progress line git prints first', () => {
  const stderr = "Preparing worktree (detached HEAD 62aa60a)\nfatal: '/x/.relevo-worktrees/shop-42' is a missing but already registered worktree;\nuse 'add -f' to override";
  const runner = fakeRunner({ fail: { 'git worktree add': { stderr } } });
  const r = createWorktree({ issue: '42', config, runner });
  assert.equal(r.status, EXIT.failed);
  assert.ok(r.messages[0].includes('is a missing but already registered worktree'));
  assert.ok(!r.messages[0].includes('Preparing worktree'));
});

test('a worktree deleted by hand is pruned before the add, so the issue can be built again', () => {
  const runner = fakeRunner();
  createWorktree({ issue: '42', config, runner });
  const git = gitCalls(runner);
  assert.ok(git.indexOf('worktree prune') !== -1 && git.indexOf('worktree prune') < git.indexOf(`worktree add --detach ${WORKTREE} origin/dev`));
});

test('remove of a folder that is gone prunes the stale registration', () => {
  const runner = fakeRunner();
  const r = removeWorktree({ issue: '42', runner, exists: () => false });
  assert.equal(r.status, EXIT.ok);
  assert.ok(gitCalls(runner).includes('worktree prune'));
});

test('a bad issue number and a folder that is not a repository are usage errors', () => {
  assert.equal(createWorktree({ issue: 'abc', config, runner: fakeRunner() }).status, EXIT.usage);
  assert.equal(createWorktree({ issue: undefined, config, runner: fakeRunner() }).status, EXIT.usage);
  const notRepo = fakeRunner({ fail: { 'git rev-parse --show-toplevel': { message: 'not a repo' } } });
  const r = createWorktree({ issue: '42', config, runner: notRepo });
  assert.equal(r.status, EXIT.usage);
  assert.equal(r.messages[0], 'not inside a git repository (or git is older than 2.31)');
});

test('Scenario: Clean end - remove runs git worktree remove from the main working tree', () => {
  const runner = fakeRunner();
  const r = removeWorktree({ issue: '42', runner });
  assert.equal(r.status, EXIT.ok);
  assert.deepEqual(gitCalls(runner).filter((a) => a.startsWith('worktree')), [`worktree remove --force ${WORKTREE}`]);
});

test('remove of a worktree that is not there removes nothing and says so', () => {
  const runner = fakeRunner();
  const r = removeWorktree({ issue: '42', runner, exists: () => false });
  assert.equal(r.status, EXIT.ok);
  assert.ok(r.messages[0].includes('nothing to remove'));
  assert.ok(!gitCalls(runner).some((a) => a.startsWith('worktree remove')));
});

test('remove from inside a linked worktree is refused, so the folder in use is never deleted', () => {
  const runner = fakeRunner({ linked: true });
  const r = removeWorktree({ issue: '42', runner });
  assert.equal(r.status, EXIT.linked);
  assert.ok(!gitCalls(runner).some((a) => a.startsWith('worktree remove')));
});

test('a worktree that cannot be removed is reported with the command to do it by hand', () => {
  const runner = fakeRunner({ fail: { 'git worktree remove': { stderr: 'fatal: locked' } } });
  const r = removeWorktree({ issue: '42', runner });
  assert.equal(r.status, EXIT.failed);
  assert.ok(r.messages[0].includes(`git worktree remove --force "${WORKTREE}"`));
});

test('go-local and go-worktree name the worktree the same way', () => {
  assert.equal(planLocalRun({ issue: '42', repoRoot: REPO, config }).worktree, worktreePath(REPO, '42'));
  assert.equal(createWorktree({ issue: '42', config, runner: fakeRunner() }).worktree, worktreePath(REPO, '42'));
});
