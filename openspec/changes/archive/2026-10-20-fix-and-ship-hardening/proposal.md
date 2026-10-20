# Proposal

## Why

`fix` and `ship` are the two commands that change a branch after a person has looked at it, and reading their skills and scripts showed gaps that lose work or let a stale approval merge new code. Each was checked against the code, not guessed:

- **F1.** When QA still rejects after the retries, `fix` leaves the changes in the working tree, but its own preflight stops on "uncommitted changes", so the next `fix` blocks itself and the person has to clean the tree by hand.
- **F3.** A branch that only holds the specification (a build that failed before any code, `qa-failed` for "specification invalid" or the budget) is treated like a branch with work to correct; `fix` tries to correct code that does not exist.
- **F5.** Nothing checks the task list around a fix: the corrections are not told apart from original tasks that were left open, and nothing proves that all of them are done at the end. Nothing asks for a regression test either.
- **S1.** If the archive was pushed and the merge then failed, running `ship` again fails at the archive step (`check-archive` exits 1 because nothing changed), so the person cannot finish.
- **S2.** `latestReviewStates` does not look at which commit was approved, and `ship-check` does not read the head of the pull request or the commit of each review. When the repository does not dismiss approvals on new commits, an old approval covers new code.
- **S3.** (a hypothesis, not reproduced) The archive pushed to the branch can turn a clean pull request into one with a conflict inside `openspec/`.
- **S4.** `ship` does not check the issue's state; it finds the pull request by branch and goes on. If the issue is `qa-failed` or `built`, the person gets no pointer to the command that is missing.
- **S5.** `ship` archives without validating the change or checking that every task is done.
- **P1.** With `merger: approver` the only check is that whoever runs `ship` is not the author. The spec writer, whom the template says "never reviews or merges", and a person outside `team.members` pass.

Already done in earlier changes (so not repeated here): the commit of `fix` goes through `commit-change.mjs` (F4) and the platform is found again with `platform-of.mjs` (F6).

## What Changes

- **`fix` keeps unfinished work safe.** When QA rejects after the retries, `fix` saves the working tree with `git stash push -u -m "relevo-fix #<n> iteration <k>"` through a new script, leaves the tree clean and the labels unchanged, and says how to resume. On the next start, a saved stash of that issue is offered back: with the person's agreement `fix` restores it and continues from the developer step. A conflict on restore stops and leaves the stash. Discarding it needs a written confirmation.
- **`fix` recognises a branch with no implementation** (only files under the change folder differ from the base branch) and says to delete the remote branch and label the issue `ready` again, instead of correcting nothing.
- **`fix` checks its task list.** Before the developer runs, the only unchecked tasks must be the corrections of this iteration; after QA passes, none may be unchecked. A fix must carry a regression test task, unless the correction only shows on a device and says so.
- **`ship` is repeatable.** It detects that the change is already archived (not in the active changes, present in the archive of the branch) and goes on from the merge. If the archive leaves the pull request in conflict only inside `openspec/`, it reverts the archive commit with a normal push, brings in the base branch, and archives again; any other conflict stops. No force push.
- **`ship` ties the approval to the code.** An approval counts only if it was given on the head commit, or on the head recorded when `ship` started (the only commit added since being the archive, which `check-archive` has verified).
- **`ship` checks the state.** It requires the issue to be `pr-open` and names the missing command otherwise.
- **`ship` validates before archiving:** `openspec validate` passes and no task is unchecked.
- **`ship` checks who runs it.** With `peer` or `roles` and `merger: approver`, the person must be a member of `team.members`, not the author, not the spec writer, and (with `roles`) an approver. Whoever approved is the expected one; another eligible person may run it after confirming in writing that they did not approve.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fix`: stash on failure and restore, branch without implementation, task checks, regression tests.
- `ship`: repeatable archive, approval tied to the commit, state requirement, validation before archive, who runs it.

## Impact

- Code: `scripts/lib/fix-stash.mjs` and `scripts/fix-stash.mjs`, `scripts/lib/branch-work.mjs` and `scripts/branch-work.mjs`, `scripts/lib/tasks-file.mjs` and `scripts/fix-tasks.mjs`, `scripts/lib/fix-guard.mjs`, `scripts/lib/archive-state.mjs` and `scripts/archive-state.mjs`, `scripts/lib/ship.mjs`, `scripts/ship-check.mjs`, `scripts/lib/archive-check.mjs`, `scripts/conflict-scope.mjs`.
- Content: `skills/fix/SKILL.md`, `skills/ship/SKILL.md`, `docs/commands.md` and `docs/commands.es.md`, `CHANGELOG.md`.
- Not changed: how `review` opens the pull request, the labels and their transitions, `review.merger` values, the squash merge.
