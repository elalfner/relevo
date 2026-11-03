## ADDED Requirements

### Requirement: A local run can retry a qa-failed issue
`go-local.mjs <issue> --retry` SHALL run `/relevo:go <issue> --retry` in the same worktree, with the same limits and tool lists, and `/relevo:go <issue> --local --retry` SHALL run it. `go` with `--retry` SHALL plan and claim the issue with the planner's `--retry`. Because the issue is never labelled `ready`, the cloud workflow SHALL NOT start, and the warning that the cloud can also build the issue SHALL NOT be shown for a retry.

#### Scenario: Local retry
- **WHEN** the person runs `go-local.mjs 67 --retry`
- **THEN** a worktree is created and the agent runs `/relevo:go 67 --retry` there, with the limits and flags of the workflow

#### Scenario: Local flag with retry
- **WHEN** the person runs `/relevo:go 67 --local --retry`
- **THEN** the skill runs `go-local.mjs 67 --retry`, shows its output and does not build in the session

#### Scenario: No cloud warning
- **WHEN** the cloud is able to build and the run is a retry
- **THEN** no warning about the cloud is printed, because the issue is not `ready`
