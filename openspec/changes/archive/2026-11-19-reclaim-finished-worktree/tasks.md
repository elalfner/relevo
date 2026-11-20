# Tasks

## 1. The verdict of the check

- [x] 1.1 In `tests/branch-worktree.test.mjs`, add tests with a fake runner for: holder clean and `HEAD` on `origin/<branch>` (removable); holder with a modified file, with an untracked file, and with a commit that is not on the remote (not removable, each reason named); the remote branch unreadable (not removable); the holder is the main working tree (not removable); `holds` for an empty, a specification-only and an implementation branch; the first line of stdout and the exit codes unchanged; run them and see them fail
- [x] 1.2 `scripts/lib/branch-worktree.mjs` and `scripts/branch-worktree.mjs`: compute `removable`, `reasons` and `holds` for the holder (read-only), print them after the existing message, add `--json`; verify the tests of 1.1 and the existing ones pass

## 2. The skills that stop at a held branch

- [x] 2.1 In `tests/skill-review.test.mjs`, `tests/skill-fix.test.mjs` and `tests/skill-ship.test.mjs`, test that each skill says that a worktree with nothing that is not on the remote can be removed, gives `git worktree remove` without `--force`, asks the person first, names what prevents it otherwise, removes nothing without a yes, and (`review`, `fix`) says there is nothing to review or correct in a specification-only branch; run them and see them fail
- [x] 2.2 `skills/review/SKILL.md`, `skills/fix/SKILL.md` and `skills/ship/SKILL.md`: replace the advice of the held-branch paragraph with the verdict, the question and the removal; keep that `review` leaves the issue `built` and that `ship` archives, pushes and merges nothing before the answer; verify the tests of 2.1 pass

## 3. Go frees the branch

- [x] 3.1 In `tests/skill-go.test.mjs`, test that the end of the run detaches (`git switch --detach`) the worktree it did not create after a hand-off, still removes the one it created, and keeps the branch checked out after a failure; run it and see it fail
- [x] 3.2 `skills/go/SKILL.md`: at the end of the run, for the case of exit 4 of `go-worktree.mjs`, detach after a hand-off; verify the test of 3.1 passes

## 4. Documentation and the whole

- [x] 4.1 `docs/execution.md` and its Spanish version (and any page that tells the person to remove the worktree by hand): say that the skills check the worktree, offer the removal and never remove it without a yes; verify `tests/docs-claims.test.mjs` passes
- [x] 4.2 Run `npm test` and `openspec validate --all`
