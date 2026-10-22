# Spec Delta: Execution Modes

## MODIFIED Requirements

### Requirement: An interactive Antigravity run executes in an isolated workspace
When `/relevo:go <issue>` is executed in an interactive Antigravity chat without `--local`, the skill SHALL NOT switch branches or commit files on the repository root working tree. It SHALL delegate execution to an isolated builder subagent using `invoke_subagent` with `TypeName: "self"`, `Role: "relevo-builder"`, and `Workspace: 'share'`. The chat orchestrator SHALL arm a defensive timeout watchdog via `schedule` with `TimerCondition` referencing the builder's conversation ID, and SHALL explicitly terminate the builder subagent with `manage_subagents(Action: "kill")` upon receiving the final completion report or upon timeout, ensuring that ephemeral worktrees are destroyed and concurrent chat conversations do not collide.

#### Scenario: Multiple concurrent Antigravity chats
- **WHEN** a user triggers `/relevo:go 1` in Chat 1 and `/relevo:go 2` in Chat 2 within the same Antigravity window
- **THEN** each chat dispatches its build via `Workspace: 'share'`, keeping the main repository root intact on its base branch and isolating commits and OpenSpec changes to their respective worktrees

#### Scenario: Explicit self builder subagent
- **WHEN** the skill `go` is rendered for Antigravity
- **THEN** the interactive instructions mandate invoking `invoke_subagent` with `TypeName: "self"` and `Role: "relevo-builder"` rather than referencing an unregistered agent type name

#### Scenario: Defensive watchdog timer
- **WHEN** the interactive orchestrator launches the builder subagent
- **THEN** it sets a safety timer via `schedule` with `TimerCondition` set to the builder conversation ID, waking up and taking the failure path if the builder hangs or crashes silently

#### Scenario: Ephemeral worktree cleanup on completion
- **WHEN** the interactive orchestrator receives the builder subagent's final report or reaches watchdog timeout
- **THEN** it terminates the subagent via `manage_subagents(Action: "kill")`, releasing session memory and ensuring the ephemeral worktree is deleted
