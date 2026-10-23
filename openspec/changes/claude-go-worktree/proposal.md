# Proposal

## Why

An interactive `/relevo:go <issue>` in Claude Code builds in the checkout of the session: it needs a clean working tree and switches the branch there. Two sessions building two issues on one machine change each other's branch and OpenSpec files, and the person's uncommitted changes stop a run. The only safe way today is `--local`, which starts a separate `claude -p` process: the person does not watch the build in their session. Interactive Antigravity already builds in its own worktree; Claude Code does not, and the person who runs two local `go` at once expects them not to step on each other.

## What Changes

- The interactive `/relevo:go <issue>` of Claude Code creates a git worktree for the issue from `origin/<base>` (the folder and name that `go-local.mjs` uses), enters it with `EnterWorktree` by `path`, and runs the whole `go` there: preflight, branch, specification, build, QA, commit, push.
- It does not create a worktree in the cloud (`--decision`), with `--local` (`go-local.mjs` makes its own) or when the session is already in a linked worktree.
- A clean end leaves the worktree, goes back to the original folder and removes the worktree; a failed run keeps it and prints its path, as `go-local.mjs` does.
- A second run on the same issue stops with a clear message instead of reusing the worktree.
- A new script `go-worktree.mjs` (`create`, `remove`) holds this logic so that it is tested; the path logic is shared with `go-local`.
- `review` stays in the main working tree.
- `--local` stays, for a build in its own process with the closed tool lists.
- The first task is a spike: if `EnterWorktree` by path does not work from a skill of the plugin, or the agents `relevo:dev` and `relevo:qa` do not work in the worktree, the interactive run delegates to `go-local.mjs` instead and the design says so.
- Out of scope: Antigravity (already isolated), the cloud workflow, the choice of base branch, and running two issues in the same worktree.

## Capabilities

### New Capabilities

### Modified Capabilities
- `execution-modes`: a local run in a Claude Code session has its own working tree, and the reason given for `--local` changes.

## Impact

- `skills/go/SKILL.md`, a new `scripts/go-worktree.mjs` with `scripts/lib/go-worktree.mjs`, a small refactor of `scripts/lib/go-local.mjs` to share the worktree path, `docs/execution.md`, `docs/commands.md` and their Spanish versions, the changelog, and tests.
- Claude Code users who run `/relevo:go` interactively: the build now happens in `.relevo-worktrees/` next to the repository, and the main checkout stays on its branch. Cloud runs and `--local` do not change. Planned for 0.5.1.
