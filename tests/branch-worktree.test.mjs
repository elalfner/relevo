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

// ---------- The verdict: can the worktree that holds the branch be removed?

const DIR = 'openspec/changes/42-add-cart';
const HELD = LIST(block(REPO, 'branch refs/heads/dev'), block(KEPT, `branch refs/heads/${BRANCH}`));

/** A runner for a held branch. `status` is the `git status --porcelain` of the holder, `ahead` the commits that are not on the remote,
 *  `paths` the files that the branch changes against the base, and `remote: false` makes the remote branch unreadable. */
function holderRunner({ list = HELD, status = '', ahead = '', paths = [], remote = true } = {}) {
  return {
    capture(cmd, args) {
      if (args.includes('--show-toplevel')) return `${REPO}\n`;
      if (args[0] === 'worktree') return list;
      if (args.includes('status')) return status;
      if (args.includes('rev-list')) {
        if (!remote) throw new Error('fatal: bad revision');
        return ahead;
      }
      if (args.includes('diff')) {
        if (!remote) throw new Error('fatal: bad revision');
        return paths.join('\n');
      }
      return '';
    },
  };
}
const verdict = (over, base = 'dev') => branchHolder({ branch: BRANCH, base, runner: holderRunner(over) });

test('Scenario: A finished worktree that holds nothing that is not on the remote - it can be removed', () => {
  const r = verdict({ paths: [`${DIR}/tasks.md`, 'lib/cart.dart'] });
  assert.equal(r.status, EXIT.held);
  assert.equal(r.removable, true);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.holds, 'implementation');
  assert.ok(r.messages.some((m) => m.includes(`git worktree remove "${KEPT}"`) && /nothing that is not on the remote/.test(m)));
});

test('Scenario: The worktree has something of its own - each reason is named and it cannot be removed', () => {
  const dirty = verdict({ status: ' M lib/cart.dart\n?? notes.txt\n' });
  assert.equal(dirty.removable, false);
  assert.match(dirty.reasons.join(';'), /2 uncommitted changes or untracked files/);
  const ahead = verdict({ ahead: 'abc\ndef\n' });
  assert.equal(ahead.removable, false);
  assert.match(ahead.reasons.join(';'), new RegExp(`2 commits that are not on origin/${BRANCH}`));
  assert.ok(ahead.messages.some((m) => /cannot be removed yet/.test(m)));
  assert.ok(!ahead.messages.some((m) => /git worktree remove "/.test(m) && /nothing that is not on the remote/.test(m)));
});

test('an untracked file alone is enough to keep the worktree', () => {
  assert.equal(verdict({ status: '?? scratch.md\n' }).removable, false);
});

test('the remote branch cannot be read - the worktree is not removable, and says why', () => {
  const r = verdict({ remote: false });
  assert.equal(r.removable, false);
  assert.match(r.reasons.join(';'), /could not read origin\//);
  assert.equal(r.holds, null);
});

test('the main working tree is never removable, and neither is a locked worktree', () => {
  const main = verdict({ list: LIST(block(KEPT, `branch refs/heads/${BRANCH}`), block(REPO, 'branch refs/heads/dev')) });
  assert.equal(main.status, EXIT.held);
  assert.equal(main.removable, false);
  assert.match(main.reasons.join(';'), /main working tree/);
  const locked = verdict({ list: LIST(block(REPO, 'branch refs/heads/dev'), `${block(KEPT, `branch refs/heads/${BRANCH}`)}locked in use\n`) });
  assert.equal(locked.removable, false);
  assert.match(locked.reasons.join(';'), /locked/);
});

test('Scenario: The branch holds only the specification - it is said, with the way out', () => {
  const r = verdict({ paths: [`${DIR}/tasks.md`, `${DIR}/specs/a/spec.md`] });
  assert.equal(r.holds, 'spec-only');
  assert.ok(r.messages.some((m) => /only the specification/.test(m) && /delete the remote branch/.test(m) && /build the issue again/.test(m)));
  assert.equal(verdict({ paths: [] }).holds, 'empty');
});

test('without --base the content of the branch is not read', () => {
  const r = branchHolder({ branch: BRANCH, runner: holderRunner({ paths: [`${DIR}/tasks.md`] }) });
  assert.equal(r.holds, null);
  assert.equal(r.removable, true);
});

test('Scenario: The output the skill already read - the first message and the exit code do not change', () => {
  const r = verdict({ status: ' M a\n' });
  assert.equal(r.status, EXIT.held);
  assert.equal(r.holder, KEPT);
  assert.match(r.messages[0], new RegExp(`${BRANCH} is checked out in another worktree: ${KEPT}`));
  assert.equal(branchHolder({ branch: BRANCH, base: 'dev', runner: holderRunner({ list: LIST(block(REPO, 'branch refs/heads/dev')) }) }).status, EXIT.free);
});
