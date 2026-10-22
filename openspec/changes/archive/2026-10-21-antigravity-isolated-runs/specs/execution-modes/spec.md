# Spec Delta: execution-modes

## MODIFIED Requirements

### Requirement: A local run uses the same limits and tools as the cloud
`go-local.mjs <issue>` SHALL run `/relevo:go <issue>` in a separate git worktree using the runner configured by `agent.build` (`claude` with `claude -p` or `antigravity` with `agent-guard.mjs` and `agy -p`), applying the respective turn, cost or token limits from `relevo.yml` and the tool restrictions of the workflow. It SHALL warn when the cloud is also able to build the issue.

#### Scenario: Local build
- **WHEN** the person runs `go-local.mjs 42`
- **THEN** a worktree is created from the base branch, the agent runs there with the limits and flags of the workflow, and on a clean end the worktree is removed

#### Scenario: Local build with Antigravity
- **WHEN** `agent.build` is `antigravity` and the person runs `go-local.mjs 42`
- **THEN** a worktree is created from the base branch, `node scripts/agent-guard.mjs run -- agy -p "/relevo:go 42"` runs there with turn and token limits, and on a clean end the worktree is removed

### Requirement: A local run has its own working tree
`go-local.mjs` and interactive Antigravity local builds SHALL run in a separate working tree outside the repository's main working tree, so that the person's uncommitted changes and concurrent sessions do not stop it or collide, SHALL remove the worktree when the run ends cleanly and SHALL keep it, printing its path, otherwise.

#### Scenario: Uncommitted changes in the repository
- **WHEN** the working tree of the repository has uncommitted changes
- **THEN** the local run is not affected, because it works in its own worktree

#### Scenario: Run fails
- **WHEN** the local run ends with an error
- **THEN** the worktree stays for inspection and its path is printed

#### Scenario: Cloud can also build it
- **WHEN** the go workflow is installed, a credential exists and the variable is not `off`
- **THEN** the command warns that the cloud may start the same issue and suggests setting `RELEVO_CLOUD_GO` to `off`

## ADDED Requirements

### Requirement: An interactive Antigravity run executes in an isolated workspace
When `/relevo:go <issue>` is executed in an interactive Antigravity chat without `--local`, the skill SHALL NOT switch branches or commit files on the repository root working tree. It SHALL delegate execution to an isolated builder subagent using `Workspace: 'share'`, ensuring that multiple chat conversations in the same IDE window run in independent ephemeral worktrees without git collisions.

#### Scenario: Multiple concurrent Antigravity chats
- **WHEN** a user triggers `/relevo:go 1` in Chat 1 and `/relevo:go 2` in Chat 2 within the same Antigravity window
- **THEN** each chat dispatches its build via `Workspace: 'share'`, keeping the main repository root intact on its base branch and isolating commits and OpenSpec changes to their respective worktrees
