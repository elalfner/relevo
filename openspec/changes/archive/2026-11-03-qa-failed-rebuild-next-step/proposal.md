# Proposal

## Why

When `go` ends in `qa-failed` and leaves no branch (the safe commit of the work in progress was refused by the scanner, or nothing was pushed for another reason), the failure comment still ends with "Your next step: /relevo:fix <n>". `fix` stops at once because the branch is not on the remote, so the assignee is sent to a command that cannot help and is not told how to get the issue built again. `messages.mjs` falls back to the `fix` recovery for every branch state except `kept`, and the next-step table has no entry for "nothing was pushed".

## What Changes

- Add a `rebuild` variant to the `qa-failed` entry of the next-step table: no command, owner is the assignee, hint says that nothing was pushed, so there is no branch to correct; resolve the cause named in the comment, remove `relevo:qa-failed` and label the issue `relevo:ready` again. English and Spanish.
- `qa_failed` messages with `branch_state` `unsafe` or `not_pushed` and no explicit `recovery` use `rebuild` instead of `fix`. `pushed`, `kept` and `existing` keep their current next step.
- Update the tests and the two specifications that describe the next step.

Out of scope: a way to rebuild without relabelling `ready` (`--retry` in `go-local`/`go-plan`, a separate change), the `assigned-secret` scanner pattern, and pushing wip branches or uploading artifacts.

## Capabilities

### New Capabilities

### Modified Capabilities
- `issue-lifecycle`: the next step of `qa-failed` has a variant for an issue with no branch.
- `go`: the failure comment points to the rebuild step, not to `fix`, when nothing was pushed.

## Impact

- `scripts/lib/next-step.mjs` (table entry), `scripts/lib/messages.mjs` (recovery default around line 452).
- `tests/messages.test.mjs`, `tests/wip-commit.test.mjs`, and a test for the table variant.
- `skills/go/SKILL.md` failure path (wording of `branch_state` and the next step) if it names the default.
