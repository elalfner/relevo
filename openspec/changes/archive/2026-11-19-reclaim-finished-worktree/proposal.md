# Proposal

## Why

`review`, `fix` and `ship` stop when another worktree holds the branch of the issue, and tell the person to remove that worktree by hand. The advice is given blind: the message does not say whether the worktree holds anything that is not on the remote, so the person cannot tell if removing it is safe, and removes it, or hesitates, on a guess. The worktree is often a leftover that holds nothing: a run of `go` that failed before it built anything leaves a worktree whose branch holds only the specification, clean and equal to the remote; and a `go` that ran in a worktree of the Claude app (not one of its own) never removes it when it ends well, because it did not create it. The person then has the branch ready for review and a worktree that blocks it.

## What Changes

- **`branch-worktree.mjs` says whether the worktree that holds the branch can be removed**, and why not when it cannot. It can be removed when its tree is clean (no change, no untracked file), its commits are all on `origin/<branch>`, and it is not the working tree the script runs in or the main working tree. It also says what the branch holds against the base branch (`spec-only`, `implementation` or `empty`), read-only, with the same classification `branch-state.mjs` uses. The output that the skills already read (the path on stdout, the exit codes) does not change; the verdict is added after it and as JSON with `--json`.
- **`review`, `fix` and `ship` use that answer.** Instead of "remove it with `git worktree remove`", when the worktree can be removed they say so, give the command and ask the person; on a yes they remove it with `git worktree remove` (never `--force`) and go on from the start of the step. When it cannot be removed they say what prevents it and change nothing. They never remove a worktree without that yes.
- **A worktree of a branch that holds only the specification is said plainly.** There is nothing in it to review or correct: the message says that and that the way out is to delete the remote branch and build the issue again, as `fix` already says.
- **`go` frees the branch when it ends in a hand-off in a worktree it did not create.** The worktree of the Claude app that `go` builds in (the case in which it builds where it is) is left detached at the commit of the hand-off, so the branch can be checked out elsewhere for the review. A worktree that `go` made is still removed, and a failed run still keeps the branch checked out where the work is.
- Tests of the verdict (clean and pushed, dirty, untracked file, unpushed commit, only the specification, main working tree), of the wording of each skill and of the detach.

Not in this change: giving `review`, `fix` and `ship` a worktree of their own (so that they never meet a held branch); a warning in `status` about finished worktrees; deleting anything without a yes from the person.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: a held branch names whether its worktree can be removed and, on the person's yes, removes it and goes on.
- `fix`: the same for `fix`.
- `ship`: the same for `ship`, before anything is archived, pushed or merged.
- `go`: a hand-off in a worktree that `go` did not create leaves the branch free.

## Impact

- `scripts/branch-worktree.mjs`, `scripts/lib/branch-worktree.mjs`, `tests/branch-worktree.test.mjs`.
- `skills/review/SKILL.md`, `skills/fix/SKILL.md`, `skills/ship/SKILL.md` and `skills/go/SKILL.md`, with `tests/skill-review.test.mjs`, `tests/skill-fix.test.mjs`, `tests/skill-ship.test.mjs` and `tests/skill-go.test.mjs`.
- The execution documentation, where it says to remove the worktree by hand.
