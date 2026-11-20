# Design

## Context

- `branch-worktree.mjs` (`scripts/lib/branch-worktree.mjs`) lists the worktrees with `git worktree list --porcelain`, finds the one other than the current that has the branch, and exits 1 with its path and a message. `review`, `fix` and `ship` read that and stop, telling the person to review there or run `git worktree remove`. It knows nothing about the content of the holder.
- Two kinds of worktree meet this check. `go-worktree.mjs` makes `.relevo-worktrees/<repo>-<issue>` and removes it when a run is built or stopped before step 2. A session of the Claude app makes its own under `.claude/worktrees/`; `go` then builds where it is (exit 4 of `go-worktree.mjs`) and never removes it. In the second case the branch stays held after a good run, and after a run that failed before it built (a branch with only the specification, clean and equal to the remote) it stays held with nothing in it.
- `classifyBranchChanges` already says `empty`, `spec-only` or `implementation`; `branch-state.mjs` uses it.
- The removal that `go-worktree.mjs remove` does uses `--force`, which is right for the worktree that `go` itself made and wrong for one of a person.

## Goals / Non-Goals

**Goals:**
- The person is told, before anything is removed, whether the holder worktree holds anything that is not on the remote.
- Removing a worktree that holds nothing costs one yes.
- `go` stops leaving the branch held after a good run in a worktree it did not make.

**Non-Goals:**
- Giving `review`, `fix` and `ship` a worktree of their own, or a warning in `status`: possible follow-ups on the same check.
- Detecting whether another session is still working in the holder. A clean tree does not prove it is not; that is why the person answers.
- Changing the exit codes or what the skills read today.

## Decisions

1. **The verdict lives in `branch-worktree.mjs`, not in each skill.** The three skills share the check already, so they share the answer. The default output stays (path on stdout, message on stderr, exit 1); the verdict is added as lines after the existing message and as JSON with `--json` (`{ holder, removable, reasons, holds }`). Alternative: each skill runs `git status` itself. Rejected: three prompts that drift, and tokens spent on commands.
2. **Removable = clean tree and no commit that is not on `origin/<branch>`.** Read in the holder with `git -C <path> status --porcelain` (untracked files included), and `git -C <path> rev-list origin/<branch>..HEAD` empty (when the remote branch cannot be read the answer is not removable). Not removable when the holder is the main working tree or is locked. The stash is not checked: stashes are shared by the repository, so removing a worktree loses none.
3. **Never `--force`, never without a yes.** `git worktree remove` without `--force` refuses a dirty tree on its own, a second guard behind the check. The yes is the person's even when the check passes, because another session may be working in a clean worktree.
4. **`holds` reuses `classifyBranchChanges`** over `origin/<base>...origin/<branch>`, read-only, so the three skills and `branch-state.mjs` cannot disagree on what "only the specification" is. For `spec-only` the message names the way out (delete the remote branch, build again) and does not suggest reviewing.
5. **`go` detaches only where it did not create the worktree.** It already knows (`go-worktree.mjs create` exit 4). At the end of a hand-off it runs `git switch --detach` there; it keeps the failure path as it is, because `fix` needs the branch where the work is. Alternative: always detach. Rejected: a failed run's work would be on no branch of that worktree.

## Risks / Trade-offs

- [A clean, pushed worktree is still in use by a live session] → The person answers before anything is removed, and `git worktree remove` without `--force` refuses what changed since.
- [The remote branch cannot be read (offline)] → Reported as not removable, with the reason; the old advice (review there, or remove it by hand) stays.
- [The output of the script is read by tests and skills] → The first lines do not change; the verdict is additive.
- [The open changes `go-visibility` and `build-runner-labels`, and `spec-only-branch-recovery`, edit the same skill files] → The edits here are narrow (the worktree paragraph of each skill and the end of the run of `go`); rebase on `dev` before applying.
