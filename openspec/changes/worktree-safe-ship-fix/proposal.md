## Why

More people now run `review`, `fix` and `ship` from a worktree (the Worktree button of Claude Code, or a worktree a failed `go` kept), and three things break there. `ship` ends with `git switch <base>` without the guard that `review` already has, so after the merge it fails in a worktree and the local copy is left half tidied. `review`, `fix` and `ship` start with `git switch <branch>`, which fails with a raw git error when another worktree (usually the one a failed `go` kept) holds that branch. And nothing in the documentation says that the Worktree button branches from the remote's default branch, so a project that works on `dev` gets worktrees that start from `main`.

## What Changes

- `ship` tidies the local copy (step 6.3) only where it can: the same condition `review` uses before it switches back to the base branch. Elsewhere it does not switch, does not delete the branch it is standing on, and says which branch the working tree stays on. It never changes the outcome of the ship, which is already merged.
- `review`, `fix` and `ship` check, before `git switch <branch>`, whether another worktree holds the branch. If one does, they stop without changing anything and name the worktree and its path, instead of showing git's error.
- A new small script, `branch-worktree.mjs`, answers that question for the three skills, so the check is tested once.
- The execution page (English and Spanish) gains an optional recipe: the Worktree button branches from the remote's default branch and takes no branch name; a `WorktreeCreate` hook that runs `git fetch origin <base>` and `git worktree add` from `origin/<base>` makes it start from the base branch. It says what the hook replaces (the default creation, `.worktreeinclude`, the branch prefix of the app) and that `/relevo:init` does not install it.
- The execution page says that `review`, `ship` and `fix` can also run in a worktree, and that a runner registered under your own user shares its home with your interactive Claude sessions.

Out of scope: installing the hook from `/relevo:init`, changing `go` or `go-local.mjs`, installing the dependencies of the project in a worktree (not verified), and making `review` create its own worktree.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ship`: the local tidy after a merge follows the working tree it runs in; a branch held by another worktree stops the run with a clear message.
- `review`: a branch held by another worktree stops the run with a clear message.
- `fix`: a branch held by another worktree stops the run with a clear message.
- `documentation`: the execution page says how to start worktrees from the base branch, and that `review`, `ship` and `fix` run in a worktree too, in both languages.

## Impact

- `skills/ship/SKILL.md`, `skills/review/SKILL.md`, `skills/fix/SKILL.md`.
- New `scripts/branch-worktree.mjs` and `scripts/lib/branch-worktree.mjs`, with a test.
- `docs/execution.md` and `docs/execution.es.md`.
- Tests: `tests/skill-ship.test.mjs`, `tests/skill-review.test.mjs`, `tests/skill-fix.test.mjs`, `tests/docs-claims.test.mjs`.
- No change to the workflows, `relevo.yml` or the cloud runs.
