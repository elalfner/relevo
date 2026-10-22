# Proposal

## Why

When developers run multiple issues concurrently in the same local workspace using Antigravity chat tabs (e.g. Chat 1 on Issue #1 and Chat 2 on Issue #2), both sessions share the same physical filesystem and the single Git `.git/HEAD` pointer of the repository root. This leads to destructive collisions: branch switches in one chat divert the commits, tests, and OpenSpec artifacts of the other, causing cross-contamination of branches and specifications.

By contrast, human developers interactively reviewing a built issue (`/relevo:review`) require the repository root where their IDE extensions, connected mobile devices (`adb`), simulators, and Flutter hot-reload tooling are active. 

To eliminate collisions while maximizing developer convenience, Relevo adopts a clean architectural principle:
1. **Automated issue builds (`go`) ALWAYS run isolated in ephemeral worktrees** (via Antigravity subagents with `Workspace: 'share'` or `go-local.mjs`), never touching or switching the repository root.
2. **The repository root is reserved for the human developer and interactive reviews (`review`)**, allowing seamless device testing in the primary IDE window without conflicting with background agents, restoring the base branch when the review finishes.

## What Changes

- **Antigravity Interactive Chat Isolation**: Adapt the `go` skill rendering for Antigravity (`scripts/lib/adapters/antigravity.mjs`) so that running `/relevo:go <issue>` in an Antigravity chat executes the build via an isolated subagent (`Workspace: 'share'`). This creates an ephemeral Git worktree automatically, keeping the repository root clean on its base branch and enabling safe concurrent issue execution across multiple chat tabs.
- **Antigravity Runner Support in `go-local.mjs`**: Extend `scripts/lib/go-local.mjs` to check `config.agent.build`. When configured for `antigravity`, `go-local.mjs` executes `agy -p` guarded by `agent-guard.mjs` inside the worktree instead of requiring `claude`.
- **Review Base-Branch Restoration**: Ensure that `/relevo:review`, which operates safely on the reserved repository root, switches the working tree back to the base branch upon opening the pull request, leaving the workspace clean for the developer.

## Capabilities

### Modified Capabilities
- `execution-modes`: Require that all local issue builds run in isolated working trees (via subagents with `Workspace: 'share'` in Antigravity or `go-local.mjs`), supporting `agent.build: antigravity` via `agy -p`.
- `review`: Require that `review` restores the repository working tree to the base branch upon completion.

## Impact

- **Adapters**: `scripts/lib/adapters/antigravity.mjs` renders the Antigravity `go` skill to invoke the builder subagent with `Workspace: 'share'`.
- **Review Skill**: `skills/review/SKILL.md` returns the working tree to the base branch after opening the pull request.
- **Local Runner**: `scripts/lib/go-local.mjs` supports `antigravity` via `agent-guard.mjs` and `agy -p`.
- **Tests**: Add test coverage in `tests/go-local.test.mjs`, `tests/adapter-antigravity.test.mjs`, `tests/execution-mode.test.mjs`, and `tests/review.test.mjs`.
