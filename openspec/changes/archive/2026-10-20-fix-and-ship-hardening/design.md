## Context

See `proposal.md`. Facts that shape the design:

- `ship-check.mjs` reads the pull request with `gh pr view --json number,state,isDraft,mergeable,title,author,reviews,statusCheckRollup,headRefName,baseRefName`. `gh` can also return `headRefOid` and, for each review, `commit { oid }`; both are read here from the `gh pr view --help` field list, and a test uses fixtures with that shape.
- `fix` and `ship` are skills: prose that calls scripts. The rules that must not vary live in scripts with tests, the skills only order the calls.
- Only English message text is stored in scripts for these two commands, as today.
- `git push --force` is never used by Relevo and the automatic classifier of this environment refuses it, so any recovery has to be a normal push.

## Goals / Non-Goals

**Goals:** work from a failed fix survives and can be resumed; `fix` does not try to correct a branch with no code; the task list is checked by a script; `ship` can be run again; an approval cannot cover code it did not see; `ship` only runs from the right state, validated, by an eligible person.

**Non-Goals:** reproducing the archive conflict (S3 stays a hypothesis, the recovery is built for it and tested with a simulated conflict), changing how `review` opens the pull request, warning that a push can dismiss approvals (minor, left out), changing `review.merger` values.

## Decisions

**D1. Stash through a script.** `scripts/lib/fix-stash.mjs` exports `stashMessage(issue, iteration)`, `findStash(listOutput, issue)` (parses `git stash list`, returns `{ ref, message, iteration }` of the newest match or null) and the script `scripts/fix-stash.mjs` has the commands `save --issue N --iteration K`, `find --issue N`, `pop --issue N` and `drop --issue N`. `save` refuses when the tree is clean; `pop` runs `git stash pop <ref>` and on conflict exits 1 printing the conflicting files (git keeps the stash on a conflicted pop); `drop` is only called by the skill after the written confirmation. The name matches exactly `relevo-fix #<n> iteration <k>` so another stash is never touched. The preflight clean-tree check of `fix` stays: after `save` the tree is clean.

**D2. Branch without implementation.** `scripts/branch-work.mjs --base <branch> --change <folder>` lists `git diff --name-only origin/<base>...HEAD` and prints `{ implementation: boolean, files }`: false when every path is under `openspec/changes/<change>/` or is empty. Exit 1 when there is no implementation, so the skill stops. The pure function `hasImplementation(paths, changeDir)` is tested.

**D3. Tasks checked by a script.** `scripts/fix-tasks.mjs --file <tasks.md> --stage before|after` with `uncheckedTasks` and a new `correctionSection(text)` in `tasks-file.mjs` that returns the ids of the last `Review corrections` section. `before`: every unchecked id must be in the last correction section, and (regression rule) at least one of its tasks must start with `Test:` unless all of them end with `(device only)`. `after`: no unchecked id. The regression rule is enforced in `before` because that is when the specification is still being written; the guard `fix-guard.mjs` stays as is. A task named `Test: ...` is a convention written in the skill; the check is on the text, not on whether a test file exists (the QA agent verifies that).

**D4. Archive state.** `scripts/archive-state.mjs --change <folder>` runs `openspec list --json` and lists `openspec/changes/archive/`, then prints `active`, `archived` or `missing`. The pure function `archiveState({ active, archived, change })` matches the folder name exactly in the active list, and `YYYY-MM-DD-<folder>` in the archived list. `ship` skips the archive step on `archived`, stops on `missing`.

**D5. Approval tied to the commit.** `shipDecision` takes `baseline` (the head recorded when `ship` started, optional). `latestReviewStates` keeps, per person, the state and the commit oid of the latest decisive review. An `APPROVED` counts only if its oid equals `pr.headRefOid` or `baseline`. A review without a commit oid (older gh) does not count as stale, so an older `gh` does not block every merge; `ship-check` prints a warning in `summary.warnings` in that case. `ship-check.mjs --baseline <oid>`; the skill records the head with `git rev-parse HEAD` after the first check and passes it to the second. The archive commit is the only commit allowed between them, and `check-archive` already verifies that it touches only `openspec/`; when the recovery of D7 adds commits (revert, merge of the base, new archive) the head moves again, so the skill asks for the approval again and does not pass a baseline in that case.

**D6. State and eligibility in the same decision.** `shipDecision` also takes `labels` (the issue's) and returns the reason "the issue is `<state>`: run `<command>` first" when the state is not `pr-open`. The command comes from a small table in `ship.mjs` (`built`, `in-review` → `/relevo:review <n>`; `qa-failed`, `changes-requested` → `/relevo:fix <n>`; none → `/relevo:review <n>`). When `labels` is not given (a saved `--input`), the state is not checked, so the tests of today still pass. Eligibility: with `merger: approver`, the invoker must not be the `spec_writer`, must be in `team.members` when that list is not empty, and in `team.approvers` in `roles` mode; if all of that holds and the invoker is not in `approvedBy`, `confirm` gets `not-approver`, and the skill asks for the written confirmation.

**D7. Archive recovery.** `scripts/conflict-scope.mjs` reads `git diff --name-only --diff-filter=U` (or paths from stdin) and exits 0 when every conflicted path is under `openspec/`, 1 otherwise, printing the outside files. The skill's step: if `ship-check` after the archive says `CONFLICTING`, `git revert --no-edit <archive commit>`, `git merge origin/<base>`; if the merge conflicts, `conflict-scope.mjs` decides; outside → `git merge --abort` and stop; inside → also abort, since the conflicting specification will be produced again by the new archive: the order is revert, merge the base (conflict-free once the archive is reverted, because the conflict came from the archive), archive again, `check-archive`, push. This is the agreed option B; it was not reproduced, so the tests simulate the conflict in a throwaway repository and the findings page says so.

**D8. Validation before archiving.** `ship` runs `openspec validate "<change>"` and `fix-tasks.mjs --stage after` (no unchecked tasks). One script for both fix and ship keeps the rule in one place.

## Risks / Trade-offs

- `gh pr view` may not return the commit of a review on an old `gh`: handled by the warning above.
- A stash is local to one clone: a fix started on another machine does not see it. The skill says so when it saves.
- The `Test:` convention is a text check; a task can lie. QA remains the check on the substance.
