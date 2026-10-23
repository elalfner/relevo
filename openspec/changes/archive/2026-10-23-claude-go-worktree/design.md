# Design

## Context

- `go-local.mjs` already makes a detached worktree at `<parent of the repository>/.relevo-worktrees/<repo>-<issue>` from `origin/<base>`, runs `claude -p` there, removes it on a clean end and keeps it otherwise. The branch is made later by step 2 of the skill (`git switch -c <branch> origin/<base>`), which works in a detached worktree.
- The interactive skill has no such step: step 0 requires a clean tree and step 2 switches the branch in the checkout of the session.
- Interactive Antigravity solves it with a `self` subagent in `Workspace: 'share'`. That does not carry over: `go` launches `relevo:dev` and `relevo:qa` as subagents, and a subagent does not start subagents.
- `EnterWorktree` by `name` makes a new branch from `origin/<default branch>` (`worktree.baseRef`), which is `main` here, while Relevo builds on `branches.base` (`dev`). By `path` it enters a worktree that already exists in `git worktree list`, and `ExitWorktree` does not remove such a worktree.
- The tool says it is for when the user or the project instructions ask for a worktree. Whether the instruction of a plugin skill counts is not known.

## Goals / Non-Goals

**Goals:**
- Two interactive `go` on one machine do not change each other's branch or files, and the person's uncommitted changes do not stop a run.
- The person still sees the build in their session.
- One tested place for the path, the creation and the removal.

**Non-Goals:**
- Antigravity, the cloud workflow and `--local` do not change.
- No change to what `go` does inside the worktree.
- No lock between a local and a cloud run (the existing warning stays).

## Decisions

1. **Create with git, enter by path.** `go-worktree.mjs create <issue>` runs `git fetch origin <base>` and `git worktree add --detach <path> origin/<base>`, with the path of `go-local`; the skill then calls `EnterWorktree` with that `path`. `name` is not used because it branches from the wrong base. The path function moves to a shared module that `go-local` also imports, so the two cannot drift.
2. **One script, two commands.** `create` prints the path as JSON; `remove` runs `git worktree remove --force` for the issue. `create` exits with a distinct code and a message when the path already exists (the same issue twice) and when the session is already in a linked worktree (`git rev-parse --git-dir` differs from `--git-common-dir`), so the skill continues in place in the second case.
3. **When to skip.** `--decision` (cloud), `--local` (the process is started in a worktree by `go-local`, which the linked-worktree check also sees) and an existing linked worktree. The skill decides by the exit code of `create`, not by guessing.
4. **Exit.** The skill always calls `ExitWorktree` with `keep` to go back to the original folder. It then calls `go-worktree.mjs remove` when the issue ends `built` or a gate decision stopped the run before anything was built; after the failure path or any other stop it leaves the worktree and prints the path. All of this is written inside the `## Where it runs` section of the skill, which the Antigravity renderer replaces whole, so the Claude tool names do not reach the Antigravity plugin. This is the rule of `go-local`.
5. **Preflight inside.** Step 0 moves after the entry, so the clean-tree check applies to the worktree. A repository where `go` is started with `--decision` is unchanged.
6. **`review` is not touched.** It needs the device and the main folder.
7. **The spike decides.** If the spike shows that `EnterWorktree` by path fails from a skill, or that `relevo:dev` and `relevo:qa` do not work in the entered folder, the interactive run delegates to `go-local.mjs` (the behaviour of `--local`), the spec scenarios that mention entering are rewritten for that, and the loss is said in the docs: the build is not shown in the session.

## Risks / Trade-offs

- `EnterWorktree` may refuse to run from a skill. Mitigation: the spike comes first and has a defined fallback.
- The agents may keep the original folder as their working directory. Mitigation: the spike checks it; the skill may pass the worktree path to each agent as the folder to work in.
- A session that ends midway leaves a worktree. Mitigation: the same as `go-local`; the path is printed. `doctor` does not list leftover worktrees today, and this change does not add that.
- The session cannot leave a worktree it did not create with the tool. Mitigation: `ExitWorktree keep` returns to the original folder, and removal is done by the script.

## Spike result

Run on 2026-10-22 in a session of Claude Code, with a throwaway worktree of this repository made as `go-worktree.mjs create` will make it (`git worktree add --detach <parent>/.relevo-worktrees/<name> origin/dev`).

- **`EnterWorktree` by `path` works** and asked for nothing: the session's folder became the worktree and `--git-dir` differed from `--git-common-dir`, which is the check that `create` uses to see a linked worktree. It was called by the session itself, not from inside a plugin skill; a skill is instructions for the same session with the same tools, and nothing refused the call, but the final run of task 5.1 is the proof from a skill.
- **`relevo:dev` and `relevo:qa` work in the entered folder.** Both reported the worktree as their `pwd`. This only shows the folder they start in; their writes follow it for relative paths, and the skill keeps using relative paths.
- **`ExitWorktree` with `keep` returns to the original folder** and leaves the worktree and its files on disk. The session does not remove a worktree it entered by `path`, so `go-worktree.mjs remove` does it.
- **The same path twice fails by itself**: `git worktree add` says the path already exists. `create` checks it first to give the message of the spec.
- **In this harness the agents were started in the background** even though the skill needs them in the foreground. The rule of the skill about foreground subagents is unchanged and is not part of this change.

The decision stands: enter by path, no fallback to `go-local.mjs`.


## Final check (task 5.1)

On 2026-10-23, `npm test` passed (1232 tests, 0 failures) and `openspec validate --all` passed (20 of 20). The person then ran two interactive `/relevo:go` at once, in two Claude Code sessions on the main checkout of the sandbox repository, with the plugin of this change, and reported that everything worked: each run made its own worktree under `.relevo-worktrees/`, the main checkout kept its branch and got no OpenSpec files, both issues reached `relevo:built`, and both worktrees were removed at the end. This confirms what the spike left open: `EnterWorktree` by path works when the skill calls it. The issue numbers and run logs were not recorded.
