## MODIFIED Requirements

### Requirement: A local run uses the same limits and tools as the cloud
`go-local.mjs <issue>` SHALL run `/relevo:go <issue>` in a separate git worktree using the runner configured by `agent.build` (`claude` with `claude -p` or `antigravity` with `agent-guard.mjs run` and `agy`), applying the respective turn, cost or token limits from `relevo.yml` and the tool restrictions of the workflow. With `antigravity` it SHALL pass the guard only arguments the guard accepts, and a run the guard refuses to start SHALL keep the worktree and print its path. It SHALL warn when the cloud is also able to build the issue.

#### Scenario: Local build
- **WHEN** the person runs `go-local.mjs 42`
- **THEN** a worktree is created from the base branch, the agent runs there with the limits and flags of the workflow, and on a clean end the worktree is removed

#### Scenario: Local build with Antigravity
- **WHEN** `agent.build` is `antigravity` and the person runs `go-local.mjs 42`
- **THEN** a worktree is created from the base branch, `agent-guard.mjs run` starts `agy` there for `/relevo:go 42` with the turn and token limits of `relevo.yml`, a time limit and a summary file outside the repository, and on a clean end the worktree is removed

#### Scenario: The guard rejects the command
- **WHEN** `agent.build` is `antigravity` and `agent-guard.mjs` exits with its usage code
- **THEN** the run is reported as failed, the worktree is kept and its path is printed
