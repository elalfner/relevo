# Design: Antigravity Interactive Safeguards

## Context

See `proposal.md` for motivation and `specs/execution-modes/spec.md` for requirements.

In Antigravity IDE, `/relevo:go` is adapted through `scripts/lib/adapters/antigravity.mjs`. In commit `cacd7742`, interactive execution was directed to use `Workspace: 'share'`. To ensure complete operational resilience during end-to-end runs, the prompts generated for the Antigravity plugin need precise guidance for subagent invocation, timeout safety, and worktree destruction.

## Goals / Non-Goals

**Goals:**
- Guarantee that interactive `/relevo:go` in Antigravity chat never fails due to an unregistered subagent type name.
- Guarantee that a crashed or deadlocked subagent never leaves the chat orchestrator sleeping indefinitely.
- Ensure all ephemeral worktrees created via `Workspace: 'share'` are deterministically destroyed when the build ends or fails.
- Ensure child subagents (`relevo-dev`, `relevo-qa`) are also terminated after their reports are verified.

**Non-Goals:**
- Modifying Claude Code subagent execution patterns (Claude subagents are foreground and process-managed differently).
- Changing headless cloud build behavior (`agent-guard.mjs` already handles process timeouts and killing process groups).

## Decisions

### Decision 1: Use `TypeName: "self"` with `Role: "relevo-builder"` for Interactive Isolation

- **Decision**: In `WHERE_RUNS_FOR_ANTIGRAVITY` ([antigravity.mjs](file:///Users/urbanconnections/Proyectos/relevo/scripts/lib/adapters/antigravity.mjs)), instruct the chat orchestrator to invoke the builder via `invoke_subagent` with `TypeName: "self"`, `Role: "relevo-builder"`, and `Workspace: 'share'`.
- **Rationale**: `TypeName: "self"` inherits all registered tools of the active workspace without requiring a separate pre-registered agent manifest. The explicit specification prevents the LLM from attempting to call unregistered names like `TypeName: "relevo-builder"` or `TypeName: "builder"`.
- **Alternative considered**: Creating a dedicated `agents/relevo-builder.md` manifest. Rejected because `relevo-builder` requires full write, read, and command tools, which `self` already provides natively without extra packaging overhead.

### Decision 2: Defensive Watchdog with `schedule` and `TimerCondition`

- **Decision**: Instruct the chat orchestrator to call `schedule(DurationSeconds: 1200, TimerCondition: "<builderId>")` immediately after `invoke_subagent`.
- **Rationale**: Antigravity's `TimerCondition` cancels the timer early at zero cost the moment the subagent delivers its final report message. If the subagent hangs, enters an infinite loop, or crashes silently without sending a message, the timer wakes up the orchestrator, which then kills the subagent and routes to Relevo's failure path (`qa-failed`), preventing orphaned issues in `building`.
- **Alternative considered**: Pure reactive wakeup without a timer. Rejected because silent subagent crashes or freezes leave the session asleep forever with no recovery mechanism.

### Decision 3: Mandatory Subagent Teardown via `manage_subagents kill`

- **Decision**: Instruct the chat orchestrator to call `manage_subagents(Action: "kill", ConversationIds: ["<builderId>"])` immediately upon receiving the final report (or upon watchdog timeout).
- **Decision**: Similarly, in `FOREGROUND_FOR_ANTIGRAVITY`, instruct the builder to terminate `relevo-dev` and `relevo-qa` via `manage_subagents kill` once their respective reports are processed.
- **Rationale**: In Antigravity, terminating a subagent automatically deletes the linked ephemeral worktree created by `Workspace: 'share'`. It also prevents background task accumulation in long-lived IDE sessions.

## Text Rewrite Specification

### `WHERE_RUNS_FOR_ANTIGRAVITY` Update

```markdown
**In an interactive Antigravity chat session** (started by hand without `--decision` and without `--local`), do not switch branches or build directly in this workspace root (multiple chat tabs share this workspace and will collide). Instead, isolate the build:
1. Call `invoke_subagent` with `TypeName: "self"`, `Role: "relevo-builder"`, `Workspace: 'share'`, passing the full build instructions for the issue.
2. Call `schedule` with `DurationSeconds: 1200` and `TimerCondition: "<builder_conversation_id>"` as a watchdog timer.
3. Yield your turn. If the subagent completes normally, the timer cancels early and you are reactivated with its report. If the timer fires, the subagent timed out.
4. Call `manage_subagents` with `Action: "kill"` and `ConversationIds: ["<builder_conversation_id>"]` to delete the ephemeral worktree and clean up session state.
5. If the subagent succeeded, report the outcome; if it timed out or failed, take the failure path. The repository root remains clean on its base branch.
```

### `FOREGROUND_FOR_ANTIGRAVITY` Update

Include explicit cleanup of child subagents:
```markdown
After reactivated with the subagent report, verify it, terminate the subagent using `manage_subagents(Action: "kill", ConversationIds: ["<subagent_id>"])` to free context, and proceed to the next step. If you cannot get a report or the subagent fails, take the failure path.
```

## Risks / Trade-offs

- **[Risk: Subagent timeout threshold too tight for huge codebases]** → Mitigation: 1200s (20 minutes) is ample for normal builds; the developer can also run CLI `go-local.mjs` for massive tasks.
- **[Risk: `manage_subagents kill` executed before reading report]** → Mitigation: The prompt explicitly directs the agent to verify the report and extract results *before* calling `manage_subagents kill`.
