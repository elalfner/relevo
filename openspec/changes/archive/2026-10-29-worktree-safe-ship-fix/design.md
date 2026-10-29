## Context

`go` already builds in its own worktree and detects a linked one (`go-worktree.mjs`, exit 4). `review` step 9 already switches back to the base branch only in the main checkout when no other worktree holds it. `ship` step 6.3 and the `git switch <branch>` of `review`, `fix` and `ship` have no such care. The Worktree button of Claude Code branches from the remote's default branch (`worktree.baseRef: fresh`, read from `origin/HEAD`) and takes no branch name; a `WorktreeCreate` hook replaces the creation. Observed on Claude Desktop: the button runs the hook with `session_id`, `cwd` and `name` as input, and a hook that prints the path of the new worktree is accepted. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- `ship` never leaves a half-tidied copy or a confusing error after a merge that succeeded.
- Whoever runs `review`, `fix` or `ship` on a branch held by another worktree is told which worktree, with its path, before anything changes.
- The recipe for starting worktrees from the base branch is written down, honest about what it gives up.

**Non-Goals:**
- Installing or generating the hook from `/relevo:init`; changing `go` or `go-local.mjs`; making `review`, `ship` or `fix` create worktrees of their own; installing the project's dependencies in a worktree.

## Decisions

**One small script answers "who holds this branch".** `scripts/branch-worktree.mjs --branch <name>` reads `git worktree list --porcelain` and exits 0 when no worktree holds the branch or only the working tree it runs in does; it exits 1 and prints the path of the other worktree when one does. The three skills call it right before `git switch <branch>` and stop on exit 1, with a fixed message. The logic follows the pattern of `go-worktree.mjs`: a library with an injected runner, and a test with a fake runner. Alternative: the inline `git worktree list --porcelain | grep` that `review` step 9 uses. Rejected for this check because it has to print a path, not only answer yes or no, and three copies of the parsing could drift apart.

**`ship` reuses the condition of `review` step 9 as it is, inline.** The tidy runs `git switch <base>`, `git pull --ff-only` and `git branch -d <branch>` only when the git dir equals the common dir and no worktree holds `refs/heads/<base>`. Otherwise it runs nothing, because `git branch -d` also fails on the branch the working tree is standing on, and says which branch it stays on. Same condition, same sentence, so the two skills cannot disagree. Alternative: switch to a detached HEAD at `origin/<base>` in a worktree. Rejected: it changes the state of a worktree the person chose to keep on its branch.

**A failed tidy is a note, not a failure.** The pull request is merged, the issue closed and the labels removed before step 6.3; the report says so and adds the note.

**The recipe goes in `docs/execution.md`, under "Building on your machine", in both languages.** It is a short section with the script, the three lines of settings, and a list of what the hook gives up. The script finds the main checkout with `git rev-parse --path-format=absolute --git-common-dir`, so that a session started inside a worktree does not nest worktrees. It prints only the path on stdout and sends everything else to stderr, which the documentation of Claude Code requires of a command hook. Alternative: `worktree.baseRef: "head"`. Mentioned in one sentence and not recommended: it starts from the local `HEAD`, so it is stale unless the main checkout sits on the base branch and is up to date.

**The shared-home note is one sentence in the section on several runners.** That section already lists what runners share; the new fact is that a runner under the person's own user also shares `~/.claude` with their interactive sessions.

## Risks / Trade-offs

- [The hook was verified on one machine, in Claude Desktop] → The page says so and does not promise the same for the CLI beyond what its documentation states.
- [A hook replaces the default creation, so `.worktreeinclude` and the branch prefix of the app stop applying] → Stated in the recipe, together with how to copy the files by hand.
- [The recipe names settings and events that belong to Claude Code, not to Relevo, and `docs-claims.test.mjs` checks the names the documentation uses] → The recipe is run through that test; if it objects, the names go in code spans the test already allows, not in a weaker test.
- [`branch-worktree.mjs` reads the output of `git worktree list --porcelain`, whose `branch` line is absent for a detached worktree] → A detached worktree holds no branch, so it never blocks.

## Migration Plan

No migration. The change is in skills and documentation; a repository gets it with the next plugin version. Rollback is reverting the commit.
