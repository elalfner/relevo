# Proposal: Antigravity Interactive Safeguards

## Why

In interactive Antigravity chat sessions, running `/relevo:go <issue>` was updated to use `Workspace: 'share'` so that builds run in isolated ephemeral worktrees without switching branches or altering files in the repository root. However, empirical testing revealed three operational gaps:
1. The rendered skill prompt directed the agent to "invoke a builder subagent" without specifying `TypeName: "self"`, risking executor construction failure or hallucinated agent type names.
2. In Antigravity's reactive execution model, if a subagent encounters a fatal runtime failure or enters an unrecoverable hang, the orchestrator chat sleeps indefinitely waiting for a message that never arrives, leaving the issue stuck in `building`.
3. In Antigravity, ephemeral worktrees created via `Workspace: 'share'` are torn down when the subagent is terminated. Without an explicit cleanup instruction (`manage_subagents kill`), worktree directories remain orphaned on disk and background agents accumulate in the session context.

Closing these gaps hardens Relevo's interactive Antigravity execution to be fully resilient and autonomous.

## What Changes

- **Explicit Builder Subagent Type**: The rendered `go` skill explicitly instructs the chat orchestrator to invoke `TypeName: "self"` with `Role: "relevo-builder"` and `Workspace: 'share'`.
- **Defensive Timeout Watchdog**: The rendered `go` skill instructs the chat orchestrator to schedule a safety timer (`schedule` with `DurationSeconds` and `TimerCondition: "<builderId>"`) to wake up and trigger Relevo's failure path if the builder subagent hangs or fails silently.
- **Ephemeral Worktree Cleanup**: The rendered `go` skill instructs the chat orchestrator (and builder for child dev/qa subagents) to explicitly terminate subagents using `manage_subagents(Action: "kill")` upon receiving the final completion report or upon timeout, ensuring ephemeral worktrees are removed and context is reclaimed.
- **Renderer & Test Verification**: Update `scripts/lib/adapters/antigravity.mjs` and `tests/adapter-antigravity.test.mjs` to assert these interactive execution constraints.

## Capabilities

### Modified Capabilities

- `execution-modes`: Refine the requirement `An interactive Antigravity run executes in an isolated workspace` to mandate explicit builder subagent invocation (`TypeName: "self"`), watchdog timer protection, and explicit subagent teardown (`manage_subagents kill`).

## Impact

- **Affected Code**: `scripts/lib/adapters/antigravity.mjs` (in `WHERE_RUNS_FOR_ANTIGRAVITY` and `FOREGROUND_FOR_ANTIGRAVITY`).
- **Tests**: `tests/adapter-antigravity.test.mjs`.
- **No Impact on Claude Code**: All changes are confined to the Antigravity-specific text adaptation blocks.
