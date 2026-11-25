# Spec Delta

## ADDED Requirements

### Requirement: A local build reports its progress in the terminal
A build started by `go-local.mjs` SHALL print a line when its phase, its group in progress, its tasks done or one of its agents changes, each with the minutes so far. The lines SHALL come from files that scripts write, with no model and without reading the event stream of the agent, in the language of `relevo.yml`, and with either agent runner. Reporting SHALL never fail or stop the build.

#### Scenario: A build with three groups
- **WHEN** a person runs `go-local.mjs 42` in a terminal and the change has three groups
- **THEN** the terminal shows a line for each phase, a line when each group starts and ends with the tasks done, and a line for each lens and each agent that finishes

#### Scenario: Nothing changes
- **WHEN** the agent works for several minutes inside one group
- **THEN** no line is repeated, and the next line carries the minutes that passed

#### Scenario: The progress cannot be written
- **WHEN** the folder of the progress cannot be created or read
- **THEN** the build runs as it runs today and says once that its progress is not available

### Requirement: The state of a local build is kept beside the worktrees
The progress of a build on a machine SHALL be kept in a folder beside the worktrees of the repository, named by the repository and the issue number, outside every working tree. It SHALL survive the removal of the worktree and SHALL stay until another build of the same issue on that machine replaces it. It SHALL hold nothing that a commit of the build could pick up.

#### Scenario: A build that ended cleanly
- **WHEN** a local build of issue 42 ends and its worktree is removed
- **THEN** the folder of issue 42 still says how the build ended and what it used

#### Scenario: A second build of the same issue
- **WHEN** issue 42 is built again on the same machine
- **THEN** the state of the earlier build is replaced, not added to

#### Scenario: Clean tree
- **WHEN** the build checks that its working tree is clean
- **THEN** nothing of its progress is in the tree

### Requirement: The progress of a local build can be read while it runs
A command SHALL print the progress of the build of an issue on this machine: the phase, the group, the tasks, the minutes, when it last changed, and, once it ended, how it ended and what it used. It SHALL read only, and SHALL NOT interrupt the build. For an issue with no build on this machine it SHALL say so.

#### Scenario: Build in progress
- **WHEN** a person runs the command for issue 42 while it is being built
- **THEN** it prints the phase, "group 2 of 3", the tasks done, the minutes and the time of the last change

#### Scenario: Build ended
- **WHEN** the build of issue 42 ended in `built`
- **THEN** the command says so, with the totals of the run

#### Scenario: No build here
- **WHEN** issue 42 was never built on this machine
- **THEN** the command says that there is no local build of issue 42 here

### Requirement: A local build obeys the budget guard
A build on a machine SHALL have the progress folder that the budget guard reads, so the turns of its subagents and its minutes are counted and checked against `limits.run_max_turns` and `limits.run_max_minutes` before each launch, as in the cloud.

#### Scenario: Minutes used up
- **WHEN** a local build has run longer than `limits.run_max_minutes` and is about to launch another agent
- **THEN** the guard stops the launch and the build takes the failure path with the reason `run limit reached`

#### Scenario: Within the limits
- **WHEN** the turns and the minutes are below the limits
- **THEN** the launch goes on

### Requirement: A local build says what it used
When a build started by `go-local.mjs` ends, it SHALL print and keep in its state the totals of the run that the agent runner reports: turns, estimated cost and tokens. It SHALL NOT break them down by agent and SHALL NOT post them on the issue. When the runner reports none of them it SHALL print nothing about usage.

#### Scenario: Totals reported
- **WHEN** a local build ends and its runner reports 18 turns, a cost and token counts
- **THEN** the terminal shows them in one sentence, the state keeps them, and no comment is posted on the issue

#### Scenario: Nothing reported
- **WHEN** the runner reports no usage
- **THEN** nothing is said about usage and the build is not reported as failed

### Requirement: An interactive build shares the state and the guard
A build that a person runs in their own session, in its worktree, SHALL keep the same progress folder as a local build, so the command that prints the progress and the budget guard work for it. Its main agent SHALL have no turn or cost limit of Relevo, because a session cannot set one for itself.

#### Scenario: Progress of an interactive build
- **WHEN** a person builds issue 42 in a session and runs the command that prints the progress from another terminal
- **THEN** it prints the phase, the group and the tasks of that build

#### Scenario: Guard in a session
- **WHEN** the subagents of an interactive build have used `limits.run_max_turns` turns
- **THEN** the guard stops the next launch, as in an unattended run

### Requirement: The go skill declares no tool beyond those of an unattended run
If the `go` skill declares a list of tools so that an interactive build does not ask for permission at each step, the list SHALL be the allowed tools of the workflow and SHALL NOT include a tool that the workflow refuses. Whether the skill declares it SHALL follow the result of a recorded check that a session honours such a list; without that result the skill SHALL declare none.

#### Scenario: The list is declared
- **WHEN** the skill declares its tools
- **THEN** they are exactly the allowed tools of the workflow, and the web tools and the download commands are not among them

#### Scenario: A session does not honour it
- **WHEN** the recorded check found that a session ignores the list
- **THEN** the skill declares none and the guide says how to allow the tools by hand

## MODIFIED Requirements

### Requirement: A local run can be started from the go command
`/relevo:go <issue> --local` SHALL run `go-local.mjs` for the issue and stop, instead of building in the interactive session, so that the build runs in its own process with the closed tool lists of the workflow, which an interactive session does not have. It SHALL start the build in the background, give the command that prints its progress and end its turn. It SHALL NOT ask for the progress again at intervals. When the build ends, the session SHALL report its result.

#### Scenario: Local flag
- **WHEN** the person runs `/relevo:go 42 --local`
- **THEN** the skill starts `go-local.mjs 42` in the background, shows the command that prints its progress and does not build in the session

#### Scenario: The build ends
- **WHEN** that build ends
- **THEN** the session says how it ended, from what `go-local.mjs` printed, without the person asking

#### Scenario: While it runs
- **WHEN** the build is running and the person asks nothing
- **THEN** the session spends no turn asking how it goes
