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
When the agent step is cut by the runner or the job is cancelled or times out, and the issue is still `building` or `ready`, a step that always runs SHALL commit and push the working tree the same way, before the report of the run and before the cleanup. It SHALL NOT push when a commit is refused, SHALL NOT force-push and SHALL NOT overwrite a remote branch: it pushes only a fast-forward of what the remote has.

#### Scenario: The job is cut and the run recorded no outcome
- **WHEN** the agent step is cancelled or ends without an outcome and the working tree holds changes
- **THEN** the changes are committed and pushed to the branch of the issue, and the comment says the work was kept and that `/relevo:fix` continues from it

#### Scenario: The scans refuse the rescue commit
- **WHEN** the changes include a protected path, a restricted file, a temporary marker or a possible credential
- **THEN** nothing is pushed and the comment names the file and why

#### Scenario: Nothing changed
- **WHEN** the working tree has no change to keep
- **THEN** no commit is made, nothing is pushed and the comment says nothing was built

#### Scenario: The remote branch has commits this run does not have
- **WHEN** `origin/<branch>` has a commit that the working branch lacks
- **THEN** it is not touched and the comment says so

#### Scenario: The run never left the base branch
- **WHEN** the working tree holds changes and the run is on the base branch or a detached head, not on the branch of the issue
- **THEN** the changes are carried to a new branch of the issue and kept there, and the base branch receives no commit

#### Scenario: The run is on some other branch
- **WHEN** the run is on a branch that is neither the base nor the branch of the issue
- **THEN** the changes are kept on a separate `rescue/<branch>` branch from where the run stands, nothing is pushed to the base branch, and the comment says the work is not on the branch that `/relevo:fix` reads

#### Scenario: The install step rewrote a lockfile
- **WHEN** a file already differed from the commit before the agent started (the install step rewrote a lockfile) and the agent has not changed it since
- **THEN** the rescue and the checkpoints leave it out, so that the refusal of a dependency file the issue did not list does not take the work of the agent with it

#### Scenario: The agent changed that file again
- **WHEN** the agent changed a file that was in the state recorded before it started
- **THEN** it is judged like any change, and a dependency file the issue did not list still refuses the commit

#### Scenario: The agent already took the failure path
- **WHEN** the issue is no longer `building` or `ready` because the run recorded its outcome
- **THEN** the always-running step does nothing

### Requirement: The clean-tree check ignores what the install step left
The `clean-tree` check that `go` makes before it claims work SHALL NOT count a file that the install step of the cloud job rewrote before the agent started and that still has the content recorded then. A file changed after that, and every change of a run without a record (a local run), SHALL still stop the run.

#### Scenario: The install step rewrote a lockfile and a configuration file
- **WHEN** `flutter pub get` rewrote `pubspec.lock` and `analysis_options.yaml` before the agent started, and nothing else changed
- **THEN** the check passes and the run goes on

#### Scenario: Another file changed
- **WHEN** a file that is not in the record, or that changed after it was recorded, differs from the commit
- **THEN** the check fails and lists only that file

#### Scenario: A local run
- **WHEN** there is no record of the state before the agent
- **THEN** every change counts, as before

### Requirement: The QA lenses leave out what the install step left
Before the first lens of a round, `go` SHALL list the files that are still as the install step of the cloud job left them, and SHALL give that list to every lens, which SHALL leave those files out of the diff it reads and SHALL report no finding about them. A file changed after the install SHALL NOT be in the list.

#### Scenario: A lockfile rewritten by the install
- **WHEN** the install step rewrote `pubspec.lock` and `analysis_options.yaml` and the developer did not touch them
- **THEN** no lens reports them, and the rejection of the work never rests on them

#### Scenario: The developer changed a file of the list
- **WHEN** the developer changed `pubspec.lock` after the install
- **THEN** the file is not in the list and the lenses review it like any change

#### Scenario: A local run
- **WHEN** there is no record of the state before the agent
- **THEN** the list is empty and the lenses review the whole diff, as before

### Requirement: A run that stopped at a limit is a class of its own
The outcome of a run that stopped at a limit or was cut SHALL be recorded with the class `limit`, apart from the classes of QA, inputs, policy and conflict.

#### Scenario: The class is recorded
- **WHEN** a run takes the failure path with the reason `run limit reached`
- **THEN** its usage record carries the class `limit`
