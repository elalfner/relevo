# Spec Delta

## ADDED Requirements

### Requirement: No agent starts after a limit of the run
After each agent that `go` launches finishes, `go` SHALL record its tool calls and time, read from the usage block that ends its report. Before launching another agent, `go` SHALL ask the budget guard, and SHALL NOT launch it when the turns of the subagents together reached `limits.run_max_turns` or the time of the run reached `limits.run_max_minutes`. It SHALL take the failure path with the reason `run limit reached`, naming the agents that did not run.

#### Scenario: The turns of the subagents reach the limit between two lenses
- **WHEN** the developer and two QA lenses finished and their turns together reach `limits.run_max_turns`
- **THEN** `go` launches no further lens, takes the failure path with the reason `run limit reached`, and the comment names the lenses that did not run

#### Scenario: The time of the run reaches its limit before a retry
- **WHEN** QA rejected the work and `limits.run_max_minutes` have passed since the run entered `planning`
- **THEN** the developer is not launched again and the failure path is taken with the reason `run limit reached`

#### Scenario: The run is within its limits
- **WHEN** the turns of the subagents and the minutes of the run are below their limits
- **THEN** the next agent is launched as before

### Requirement: The budget guard stops a run only on what it can read
The guard SHALL record only whole numbers, and SHALL say that it does not know, and let the run go on, when it cannot read its inputs. An error of the guard SHALL NOT fail or stop a run.

#### Scenario: The guard cannot read its inputs
- **WHEN** the ledger or the phase log is missing or unreadable, or the run has no progress directory
- **THEN** the guard says that it does not know, exits as within limits and no agent is stopped

#### Scenario: Only numbers are recorded
- **WHEN** the figures passed to the guard are not whole numbers
- **THEN** nothing is recorded and the run goes on

### Requirement: The work is kept when go stops at a limit
When `go` stops because of a limit, it SHALL commit the work in progress with the subject `wip: stopped by limit (#N)` through the same script and with the same refusals as any commit, and push it to the branch of the issue without opening a pull request. The comment SHALL say whether the work was kept.

#### Scenario: `go` stops at a limit
- **WHEN** the budget guard says a limit was reached and the developer's work is in the working tree
- **THEN** the work is committed as `wip: stopped by limit (#N)`, pushed to the branch of the issue, the issue goes to `qa-failed` with the reason `run limit reached`, and the comment says the work was kept

#### Scenario: `fix` continues from the kept work
- **WHEN** the last commit of the branch is `wip: stopped by limit (#N)`
- **THEN** `fix` treats it as work in progress, the same as the work that QA rejected

### Requirement: The work is kept when the runner cuts the run
When the agent step is cut by the runner or the job is cancelled or times out, and the issue is still `building` or `ready`, a step that always runs SHALL commit and push the working tree the same way, before the report of the run and before the cleanup. It SHALL NOT push when a commit is refused, SHALL NOT force-push and SHALL NOT touch a branch that already exists on the remote.

#### Scenario: The job is cut and the run recorded no outcome
- **WHEN** the agent step is cancelled or ends without an outcome and the working tree holds changes
- **THEN** the changes are committed and pushed to the branch of the issue, and the comment says the work was kept and that `/relevo:fix` continues from it

#### Scenario: The scans refuse the rescue commit
- **WHEN** the changes include a protected path, a restricted file, a temporary marker or a possible credential
- **THEN** nothing is pushed and the comment names the file and why

#### Scenario: Nothing changed
- **WHEN** the working tree has no change to keep
- **THEN** no commit is made, nothing is pushed and the comment says nothing was built

#### Scenario: The branch already exists on the remote
- **WHEN** `origin/<branch>` exists before the rescue
- **THEN** it is not touched and the comment says so

#### Scenario: The agent already took the failure path
- **WHEN** the issue is no longer `building` or `ready` because the run recorded its outcome
- **THEN** the always-running step does nothing

### Requirement: A run that stopped at a limit is a class of its own
The outcome of a run that stopped at a limit or was cut SHALL be recorded with the class `limit`, apart from the classes of QA, inputs, policy and conflict.

#### Scenario: The class is recorded
- **WHEN** a run takes the failure path with the reason `run limit reached`
- **THEN** its usage record carries the class `limit`
