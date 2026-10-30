import test from 'node:test';
import assert from 'node:assert/strict';
import { branchHolder, EXIT, parseWorktrees } from '../scripts/lib/branch-worktree.mjs';

const REPO = '/home/me/code/shop';
const KEPT = '/home/me/code/.relevo-worktrees/shop-42';
const BRANCH = 'feature/42-add-cart';

const block = (path, ref) => `worktree ${path}\nHEAD 0123456789abcdef\n${ref}\n`;
const LIST = (...blocks) => blocks.join('\n');

/** A fake runner: `here` is the working tree the command runs in, `list` the porcelain output; `fail` makes git fail. */
function fakeRunner({ here = REPO, list = '', fail = false } = {}) {
  return {
    capture(cmd, args) {
      if (fail) throw new Error('fatal: not a git repository');
      if (args.includes('--show-toplevel')) return `${here}\n`;
      if (args[0] === 'worktree') return list;
      return '';
    },
  };
}

test('parseWorktrees reads path and branch, and a detached worktree has no branch', () => {
  const parsed = parseWorktrees(LIST(block(REPO, 'branch refs/heads/dev'), block(KEPT, 'detached')));
  assert.deepEqual(parsed, [{ path: REPO, branch: 'dev' }, { path: KEPT, branch: null }]);
});

test('Scenario: The branch is free - no worktree holds it', () => {
  const list = LIST(block(REPO, 'branch refs/heads/dev'));
  const result = branchHolder({ branch: BRANCH, runner: fakeRunner({ list }) });
  assert.equal(result.status, EXIT.free);
  assert.equal(result.holder, null);
});

test('Scenario: The branch is free - only the working tree it runs in holds it', () => {
  const list = LIST(block(REPO, `branch refs/heads/${BRANCH}`), block(KEPT, 'branch refs/heads/other'));
  assert.equal(branchHolder({ branch: BRANCH, runner: fakeRunner({ list }) }).status, EXIT.free);
});

test('Scenario: A failed go left its worktree - the other worktree is named with its path', () => {
  const list = LIST(block(REPO, 'branch refs/heads/dev'), block(KEPT, `branch refs/heads/${BRANCH}`));
  const result = branchHolder({ branch: BRANCH, runner: fakeRunner({ list }) });
  assert.equal(result.status, EXIT.held);
  assert.equal(result.holder, KEPT);
  assert.match(result.messages[0], new RegExp(`${BRANCH} is checked out in another worktree: ${KEPT}`));
  assert.match(result.messages[0], /git worktree remove/);
});

test('Scenario: Review in a worktree of its own - the main checkout holding another branch does not block', () => {
  const list = LIST(block(REPO, 'branch refs/heads/dev'), block(KEPT, 'branch refs/heads/worktree-x'));
  assert.equal(branchHolder({ branch: BRANCH, runner: fakeRunner({ here: KEPT, list }) }).status, EXIT.free);
});

test('a detached worktree holds no branch, so it never blocks', () => {
  const list = LIST(block(REPO, 'branch refs/heads/dev'), block(KEPT, 'detached'));
  assert.equal(branchHolder({ branch: BRANCH, runner: fakeRunner({ list }) }).status, EXIT.free);
});

test('a missing --branch is a usage error', () => {
  assert.equal(branchHolder({ branch: undefined, runner: fakeRunner() }).status, EXIT.usage);
});

test('outside a git repository is a usage error, not an answer', () => {
  const result = branchHolder({ branch: BRANCH, runner: fakeRunner({ fail: true }) });
  assert.equal(result.status, EXIT.usage);
  assert.match(result.messages[0], /not inside a git repository/);
});
