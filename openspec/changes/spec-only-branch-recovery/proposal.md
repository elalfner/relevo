# Proposal

## Why

A run of `go` that fails after it committed the specification (step 3) and before it builds (step 4), for example with the reason `profile not resolved`, leaves a branch on the remote that holds only the specification. That state has no way out. The failure comment says the branch is pushed and sends the person to `/relevo:fix <n>`, but there is no code to correct. `go --retry` refuses because the branch exists. `fix` is meant to stop on such a branch, but its check (`branch-work.mjs`) reports implementation when it is given the change as a path instead of as a folder name, so `fix` goes on over a branch with no code. The only way out is to delete the remote branch by hand, and nothing says so.

## What Changes

- **`branch-work.mjs` accepts the change as a folder name or as a path** (`31-summary` or `openspec/changes/31-summary`, with or without a trailing slash) and ignores everything under the change folder when it decides whether the branch holds implementation. Today a path makes every file of the change count as code. An empty or malformed value is a usage error (exit 2), never a wrong answer.
- **`go` resolves the stack profile before it commits the specification**, so the failure `profile not resolved` happens before anything is pushed and leaves no half-built branch.
- **A failure after the specification was pushed names the way out.** When the branch that the run pushed holds only the specification, the failure comment carries `recovery` `delete-branch` (as the one for an existing branch does) instead of recommending `fix`, and says the command that deletes the branch.
- **A refused retry says exactly how to recover.** When `go-plan.mjs --retry` finds a branch of the issue that holds only the specification, the refusal says to delete that branch (with the command) and run the retry again, instead of sending the person to `fix`.
- Tests for both defects and for the three messages.

Not in this change: `--retry` reusing a branch that already exists, and `resume-check.mjs` resuming from the commit of the specification. Both would need the `docs: specification` commit to carry `Issue-hash` and would touch the rule that a branch with a commit of a person is never overwritten; they are left for a separate change if the manual deletion proves too costly. Also not touched: `qa.rules_from` and the workflows of the example repository.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fix`: the check for a branch without implementation accepts the change as a name or as a path.
- `go`: the profile is resolved before the specification is committed, a failure after the push of a specification-only branch names the deletion, and the refused retry says how to recover.

## Impact

- `scripts/branch-work.mjs`, `scripts/lib/branch-work.mjs`, `tests/branch-work.test.mjs`.
- `skills/go/SKILL.md` (order of steps 3 and 4, failure path), `skills/fix/SKILL.md` (how `<change>` is passed).
- `scripts/go-plan.mjs` and `scripts/lib/next-step.mjs` (the hint of `delete-branch`), with their tests and the skill tests.
- Documentation of the failure comment, if it quotes the old next step.
