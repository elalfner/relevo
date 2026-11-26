# execution-modes Specification

## Purpose
Decides where `go` and `ship` run and what each way shows. The cloud runs when a credential is installed and falls back to the local machine when it is not, a variable pauses it at once, and a local run uses the same limits, tools and budget guard in its own worktree. Every run reports its consumption by agent and by model, and says when it stopped at a limit.

## Requirements

### Requirement: Where go builds is decided by what is installed, not by a setting
Whether `go` builds in the cloud, on a person's machine or both SHALL follow from the workflow files that are installed, the model credential that exists as a repository secret and the repository variable `RELEVO_CLOUD_GO`, and `relevo.yml` SHALL have no setting for it. With nothing changed the default SHALL be both. Which of the two builds one issue SHALL follow from what a person does with it: the `go` label asks the cloud, and the `go` command builds on the machine where it is run.

#### Scenario: Both
- **WHEN** the `go` workflow is installed, a credential secret exists and the variable is not set
- **THEN** a `go` label on a `ready` issue starts a cloud build, and a person can still run `/relevo:go <n>` on their machine for another `ready` issue

#### Scenario: Local only
- **WHEN** the `go` and queue workflows are not installed
- **THEN** nothing builds in the cloud, a `go` label has no effect, and `/relevo:go <n>` works as usual

### Requirement: A variable pauses the cloud at once
With the repository variable `RELEVO_CLOUD_GO` set to `off`, a `go` label SHALL start no cloud build and the queue SHALL dispatch none. Changing the variable SHALL need no change to any file. A `go` label applied during the pause SHALL stay on the issue as a pending request, and the cloud SHALL serve it after it resumes with nothing applied again.

#### Scenario: Paused
- **WHEN** `RELEVO_CLOUD_GO` is `off` and `go` is applied to a `ready` issue
- **THEN** no workflow run builds it, and the issue stays `ready` with `go`, which a local build can still take

#### Scenario: Resumed
- **WHEN** the variable is deleted or set to anything else
- **THEN** the next `go` label or queue run builds in the cloud again, and the requests made during the pause are served

### Requirement: A cloud without a credential falls back instead of failing
When neither `ANTHROPIC_API_KEY` nor `CLAUDE_CODE_OAUTH_TOKEN` exists, the gate SHALL NOT claim the issue or start the build job. It SHALL leave the issue `ready`, remove the `go` label and comment that the cloud is not configured, naming `/relevo:go <n>` for a local run and the two secrets for the cloud.

#### Scenario: No credential
- **WHEN** a person applies `go` to a `ready` issue in a repository with the `go` workflow and no model credential
- **THEN** the issue stays `ready` without `go`, the build job does not run, and one comment says what to do

### Requirement: Two credentials are supported and the mode is deduced
A repository SHALL be able to use a Console API key (secret `ANTHROPIC_API_KEY`) or a subscription token (secret `CLAUDE_CODE_OAUTH_TOKEN`). The mode SHALL be deduced from the name of the secret that exists, never stored in `relevo.yml`. If both exist the check SHALL warn, because the workflow uses one of them and the other is ambiguous.

#### Scenario: Subscription
- **WHEN** only `CLAUDE_CODE_OAUTH_TOKEN` exists
- **THEN** the mode is `subscription`, `run_max_cost` is a notional ceiling, and the quota is shared with the use of the person who owns the token

#### Scenario: API key
- **WHEN** only `ANTHROPIC_API_KEY` exists
- **THEN** the mode is `api_key` and `run_max_cost` is a real ceiling on spending

#### Scenario: Both
- **WHEN** both secrets exist
- **THEN** `doctor` warns and says which one the workflow uses

### Requirement: A usage limit is reported as a usage limit
When a cloud run ends because the usage limit, the quota or the credit was reached, the final step SHALL say so and say when the issue will retry (see the capability `usage-limit-retry`), instead of the generic "ended without a result" and instead of telling a person to apply `ready` again later. When the retry is not possible (the retries are used up or the work could not be kept) it SHALL say so and ask a person.

#### Scenario: Limit reached
- **WHEN** the execution log of the failed run shows that a usage limit was reached: its final result is an error whose text says so, or a rate-limit event has a status other than `allowed`
- **THEN** the issue returns to the queue with a retry time, is not marked `build-failed`, and the comment says the usage limit was reached and when it will retry

#### Scenario: Retries used up
- **WHEN** the run of the third retry ends at a usage limit
- **THEN** the issue is marked `build-failed` and the comment says the usage limit was reached again and asks a person

#### Scenario: Another failure
- **WHEN** the run failed for any other reason, including a log whose rate-limit events all report `allowed`
- **THEN** the comment is the generic one with the link to the run

### Requirement: The consumption of a run is visible
After a cloud run, a comment on the issue SHALL give the number of turns, the cost and the tokens that the execution log reports, and say that the cost is notional when the mode is a subscription. The comment SHALL also carry a hidden, machine-readable marker with those figures and whether the cost is notional, so that they can be added up without reading the sentence. When the log reports none of them, nothing SHALL be posted.

#### Scenario: Log with usage
- **WHEN** the execution log has a result with turns, cost and token counts
- **THEN** one comment states them and carries the marker with the same figures

#### Scenario: Log with partial usage
- **WHEN** the execution log reports the turns but not the cost
- **THEN** the sentence and the marker both give the turns and leave the cost out

#### Scenario: Log without usage
- **WHEN** the execution log is missing or has no result
- **THEN** no comment is posted and the run is not reported as failed

### Requirement: A local run uses the same limits and tools as the cloud
`go-local.mjs <issue>` SHALL run `/relevo:go <issue>` in a separate git worktree using the runner configured by `agent.build` (`claude` with `claude -p` or `antigravity` with `agent-guard.mjs run` and `agy`), applying the respective turn, cost or token limits from `relevo.yml` and the tool restrictions of the workflow. With `antigravity` it SHALL pass the guard only arguments the guard accepts, and a run the guard refuses to start SHALL keep the worktree and print its path. It SHALL NOT warn that the cloud can also build the issue, because a local build does not start the cloud.

#### Scenario: Local build
- **WHEN** the person runs `go-local.mjs 42`
- **THEN** a worktree is created from the base branch, the agent runs there with the limits and flags of the workflow, and on a clean end the worktree is removed

#### Scenario: Local build with Antigravity
- **WHEN** `agent.build` is `antigravity` and the person runs `go-local.mjs 42`
- **THEN** a worktree is created from the base branch, `agent-guard.mjs run` starts `agy` there for `/relevo:go 42` with the turn and token limits of `relevo.yml`, a time limit and a summary file outside the repository, and on a clean end the worktree is removed

#### Scenario: The guard rejects the command
- **WHEN** `agent.build` is `antigravity` and `agent-guard.mjs` exits with its usage code
- **THEN** the run is reported as failed, the worktree is kept and its path is printed

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

### Requirement: A local run has its own working tree
`go-local.mjs`, interactive Antigravity local builds and interactive Claude Code builds SHALL run in a separate working tree outside the repository's main working tree, so that the person's uncommitted changes and concurrent sessions do not stop it or collide, SHALL remove the worktree when the run ends cleanly and SHALL keep it, printing its path, otherwise.

#### Scenario: Uncommitted changes in the repository
- **WHEN** the working tree of the repository has uncommitted changes
- **THEN** the local run is not affected, because it works in its own worktree

#### Scenario: Run fails
- **WHEN** the local run ends with an error
- **THEN** the worktree stays for inspection and its path is printed

#### Scenario: Cloud can also build it
- **WHEN** the go workflow is installed, a credential exists and the variable is not `off`
- **THEN** the command warns that the cloud may start the same issue and suggests setting `RELEVO_CLOUD_GO` to `off`

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

### Requirement: The build installs the toolchain of the stack of the issue
The build job of the go workflow template SHALL install, without the project editing the template, the toolchain of each stack Relevo ships a profile for, each step guarded by the stack output of the decision job, so that only the toolchain of the platform of the issue is installed and the agent and QA can run the project's checks. Installing the dependencies of the project SHALL stay a choice of the project.

#### Scenario: An issue for a Flutter platform
- **WHEN** the decision job reports the stack `flutter`
- **THEN** the build job sets up Flutter before the agent runs, and the steps of the other stacks are skipped

#### Scenario: An issue for a platform of a stack with no step
- **WHEN** the stack of the platform has no toolchain step in the template
- **THEN** the build job installs none, and the project adds its own step

#### Scenario: Reading the template
- **WHEN** a person reads the build job of the template
- **THEN** every toolchain step is active and guarded by the stack it installs, and the installation of dependencies is a commented example that says why

### Requirement: An interactive Claude Code run builds in its own worktree
When `/relevo:go <issue>` runs in a Claude Code session without `--local` and without `--decision`, and the session is not already in a linked worktree, the skill SHALL create a worktree for the issue from `origin/<base>`, enter it before the preflight and do every later step there. It SHALL NOT switch branches or commit in the main working tree.

#### Scenario: Two issues at once
- **WHEN** the person runs `/relevo:go 1` in one session and `/relevo:go 2` in another
- **THEN** each builds in its own worktree and neither changes the branch or the OpenSpec files of the other or of the main working tree

#### Scenario: Uncommitted changes in the main working tree
- **WHEN** the main working tree has uncommitted changes and the person runs `/relevo:go 42`
- **THEN** the preflight passes in the worktree and the changes of the main working tree are untouched

#### Scenario: The same issue twice
- **WHEN** the worktree of the issue already exists
- **THEN** the run stops before any change and names the worktree and the command that removes it

#### Scenario: No worktree where one exists or is not needed
- **WHEN** `go` runs with `--decision`, or inside the worktree that `go-local.mjs` made, or in any linked worktree
- **THEN** no further worktree is created and the build runs where it is

#### Scenario: Clean end and failure
- **WHEN** the issue ends `built`, or a gate decision stops the run before anything is built
- **THEN** the session returns to the original folder and the worktree is removed
- **WHEN** the run ends on the failure path or stops for any other reason
- **THEN** the session returns to the original folder, the worktree is kept and its path is printed

#### Scenario: Review stays in the main working tree
- **WHEN** the person runs `/relevo:review` for the issue
- **THEN** it runs in the main working tree, as before

### Requirement: Where ship runs follows what is installed
Whether a ship can run on GitHub SHALL follow from the ship workflow being installed on the default branch and the repository variable `RELEVO_CLOUD_SHIP`; it SHALL need no model credential. `/relevo:ship <n>` SHALL keep working in every case.

#### Scenario: Ship workflow not installed
- **WHEN** the ship workflow is not installed
- **THEN** the `ship` label does nothing and `/relevo:ship <n>` works as usual

#### Scenario: No model credential
- **WHEN** neither `ANTHROPIC_API_KEY` nor `CLAUDE_CODE_OAUTH_TOKEN` exists and the ship workflow is installed
- **THEN** the `ship` label still ships

### Requirement: A variable pauses the ship workflow
With the repository variable `RELEVO_CLOUD_SHIP` set to `off`, the `ship` label SHALL start no ship. Changing the variable SHALL need no change to any file.

#### Scenario: Paused
- **WHEN** `RELEVO_CLOUD_SHIP` is `off` and a person applies the `ship` label
- **THEN** nothing is archived or merged, and the label stays for when the variable is changed back and the label is applied again

### Requirement: A local run can retry a build-failed issue
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

### Requirement: The credential line of the go workflow agrees with the secret that exists
The secret that exists decides the mode, and the active credential line of the `go` workflow SHALL be the one for that mode. A repository where only one secret exists and the workflow uses the other SHALL be reported as a configuration error, because the cloud passes the build gate and the agent step then stops with no credential.

#### Scenario: Build with a mismatch
- **WHEN** only `CLAUDE_CODE_OAUTH_TOKEN` exists and the workflow passes only `anthropic_api_key`
- **THEN** `doctor` reports it before any build, naming the line to change

#### Scenario: Agreement
- **WHEN** the line and the secret are for the same mode
- **THEN** the mode is reported as before and nothing is added

### Requirement: The consumption of a run is shown by agent and by model
When the execution log has them, the comment about a cloud run SHALL list for the main agent and each subagent its model, effort, turns, minutes, tokens and an estimated cost, and SHALL give the real cost of each model. The cost of an agent SHALL be written as an estimate. The launches of replicas SHALL NOT be in that list: they are shown apart (see "The usage comment shows the replicas apart from the rest"). The hidden marker of the comment SHALL carry the same figures under `agents` and `models`. A figure the log does not have SHALL be left out, and a log with none of these figures SHALL give the comment it gives today.

#### Scenario: A run with subagents
- **WHEN** the log shows a developer and four QA lenses, each with its model and tool calls
- **THEN** the comment lists each of them with model, effort, turns, minutes, tokens and "about" its cost, and the real cost of each model

#### Scenario: The costs add up
- **WHEN** the estimated costs of the agents of a model are added
- **THEN** they equal the real cost of that model in the log

#### Scenario: A log without the details
- **WHEN** the log has only the totals of the run
- **THEN** the comment and the marker are the same as before this requirement

#### Scenario: The marker is read by the digest
- **WHEN** the daily digest reads a marker that carries `agents` and `models`
- **THEN** it reads the totals as before and ignores the new keys

### Requirement: A run that stopped at a limit says so
The comment about a run that stopped at a limit SHALL name the limit that was reached (turns of the subagents, minutes or cost) and the agents that did not run.

#### Scenario: A time limit
- **WHEN** a run stops because `limits.run_max_minutes` passed
- **THEN** the comment says the minutes limit was reached, how many minutes the run had used and which agents did not run

#### Scenario: A limit of the runner
- **WHEN** the runner cuts the agent at its turn limit or its cost limit and the log says which
- **THEN** the comment says which of the two it was

#### Scenario: The log does not say
- **WHEN** the job was cancelled or timed out, or the log has no such result
- **THEN** the comment keeps its general wording

### Requirement: The comment says which model each role used and why
The comment about a cloud run SHALL say, for each role of the model plan, the model and the effort that were used, the source (`config`, `auto` or `issue`) and the reason, in addition to the consumption by agent. The hidden marker SHALL carry the same under `plan`. A log without a plan SHALL give the comment it gives today, and the daily digest SHALL read the totals as before and ignore the new key.

#### Scenario: A run with a plan
- **WHEN** a run launched the developer on `haiku` because the issue was small and the lenses on their defaults
- **THEN** the comment says that, with the reason, and the marker has the `plan` key

#### Scenario: A run without a plan
- **WHEN** a run made before this requirement has no plan
- **THEN** the comment and the marker are the same as before

#### Scenario: The digest
- **WHEN** the daily digest reads a marker with `plan`
- **THEN** it reads the totals as before and ignores the key

### Requirement: The comment says when the developer went up
When the developer ran a retry on a model higher than the one of the attempt before, the usage comment SHALL say, for each step, the models, the attempt and whether the gate was red or QA rejected, and the usage marker SHALL carry the same steps under `escalated`. A run with no step SHALL give the comment and the marker it gave before.

#### Scenario: A retry went up
- **WHEN** the developer ran on `haiku` and the retry on `sonnet` after a QA rejection
- **THEN** the comment says "The developer went up on a retry: haiku to sonnet on attempt 2 (QA rejected)" and the marker carries `escalated`

#### Scenario: No retry went up
- **WHEN** no retry ran or none changed the model
- **THEN** the comment and the marker have no mention of it

### Requirement: The run comment shows the seconds of each check
When the receipt of the validation gate exists in the working folder, the usage comment SHALL list each check with its seconds, marking those that were reused, and the hidden marker SHALL carry the same figures. When there is no readable receipt, nothing is added.

#### Scenario: A run ends
- **WHEN** a run ends and the gate wrote a receipt
- **THEN** the comment shows the seconds per check, with "reused" where the gate did not run it

#### Scenario: No receipt
- **WHEN** the run ended before the gate
- **THEN** the comment is as it was

### Requirement: The usage comment shows the quota window and its utilisation
When the execution log carries rate-limit events with a window and a utilisation, the usage comment SHALL say, for each window, the utilisation at the start and at the end of the run, and the reset time when the log has it; the hidden marker SHALL carry the same under `quota`. When the log has none (an API-key repository has no weekly window), no quota phrase and no `quota` key SHALL be written, and nothing SHALL be estimated.

#### Scenario: Subscription run
- **WHEN** the log has rate-limit events for the 5-hour and the weekly window
- **THEN** the comment says each window went from its first utilisation to its last

#### Scenario: API-key repository
- **WHEN** the log has no rate-limit events with a window
- **THEN** the comment is as it was, with no quota line

#### Scenario: A malformed figure
- **WHEN** an event has a utilisation that is not a number between 0 and 1
- **THEN** that figure is left out and the others are shown

### Requirement: The usage comment shows the replicas apart from the rest
When a log has launches of replicas, the usage comment SHALL list each target apart from the other agents, with its model, its attempts (launches), its turns and an estimated cost, and SHALL say what the replicas cost together and what the rest of the run cost, when the figures are there. The hidden marker SHALL carry the same under `replicas`. When no replica ran, no replica phrase and no `replicas` key SHALL be written, and the comment SHALL be the one it was.

#### Scenario: Replicas ran
- **WHEN** a run has two replica targets, one of them launched twice
- **THEN** the comment lists both targets with model, attempts, turns and cost, apart from the other agents, with the cost of the replicas and of the rest

#### Scenario: No replica ran
- **WHEN** the log has no replica launch
- **THEN** the comment and the marker have no replica phrase or key

#### Scenario: The cost of a replica is not in the log
- **WHEN** a replica's cost cannot be estimated
- **THEN** the target is listed without a cost and no total is claimed

#### Scenario: The marker is read by the digest
- **WHEN** the daily digest reads a marker with `replicas`
- **THEN** it reads the totals as before and ignores the key

### Requirement: The usage comment says why each replica ran on its model
When the usage comment lists the replicas of a run, it SHALL say after each target why its replica ran on that model: the reason the model was chosen with, from the last launch of that target, quoted as written, with the words around it from the message catalog in English and Spanish. The hidden marker SHALL carry the same reason in each replica's entry. A target with no recorded reason SHALL be listed as before.

#### Scenario: The developer is not on auto
- **WHEN** a replicated build runs with a developer whose model is written in `relevo.yml`
- **THEN** each replica is listed with its model and the reason that the repository decided the model

#### Scenario: The replicas ran on a cheaper model
- **WHEN** the developer is on `auto` and a replica ran one name below the planned model
- **THEN** the replica is listed with its model and the reason that it is one name below the planned model, not below the floor

#### Scenario: A target launched again on a stronger model
- **WHEN** a target failed twice and its last launch used the planned model
- **THEN** the reason shown for that target is the one of the last launch

#### Scenario: No reason was kept
- **WHEN** the reasons were not recorded for the run (an older `go` skill, or no progress folder)
- **THEN** the replicas are listed as before, with no reason, and the marker has no `why`

#### Scenario: Spanish repository
- **WHEN** `language` is `es`
- **THEN** the words around the reason are in Spanish and the reason is quoted as written

#### Scenario: The marker is read by the digest
- **WHEN** the daily digest reads a marker whose replicas carry `why`
- **THEN** it reads the totals as before and ignores the key

### Requirement: A local build needs no build request
`/relevo:go <issue>`, `/relevo:go <issue> --local` and `go-local.mjs <issue>` SHALL build an issue that is `ready`, with no `go` label, when the person who runs them has the permission that `ready` requires and the approval of the issue is valid. The claim SHALL move the issue from `ready` to `building` with the `local` label. The cloud workflow SHALL NOT start because of it.

#### Scenario: Approved issue built on a machine
- **WHEN** issue 42 is `ready`, the cloud builds other issues, and a person with write access runs `/relevo:go 42`
- **THEN** issue 42 becomes `building` with `local`, it is built on that machine, and no workflow run starts for it

#### Scenario: Draft
- **WHEN** issue 42 has no lifecycle label and a person runs `/relevo:go 42`
- **THEN** nothing is built and the report says that the issue needs `ready` first

#### Scenario: Person without the permission
- **WHEN** a person with read access runs `/relevo:go 42` for a `ready` issue
- **THEN** nothing is built or claimed, and the report says that building needs write access

### Requirement: A local build skips the gates that ration automatic work
A local build SHALL pass the gates that protect the build: a valid approval, an assignee, a complete text and merged dependencies. A milestone SHALL NOT be one of them. It SHALL NOT wait for the limit of concurrent agents or for the review capacity of the assignee. A file shared with an issue that is not merged SHALL NOT hold it: the build goes on and its hand-off lists the shared files.

#### Scenario: Limit of agents reached
- **WHEN** `limits.concurrent_agents` cloud builds are running and a person starts a local build
- **THEN** the local build starts

#### Scenario: Shared file
- **WHEN** issue 42 names a file that issue 40, built and not merged, also names, and a person starts a local build of 42
- **THEN** the build starts at once, and its hand-off message lists the file and issue 40

#### Scenario: Incomplete text
- **WHEN** the text of the issue lacks a required section and a person starts a local build
- **THEN** nothing is built and the issue goes to `needs-spec`, as it would in the cloud

#### Scenario: No milestone
- **WHEN** an approved issue with an assignee has no milestone and a person starts a local build
- **THEN** the build starts, as it would in the cloud

### Requirement: A local build never joins the cloud queue
A local build that cannot start because it would have to wait SHALL report why and SHALL leave the labels of the issue as they were: it SHALL NOT move an issue to `queued` or `blocked`. A decision that sends the issue back to its writer (an incomplete text, an approval that is not valid, a missing assignee) SHALL be applied as in the cloud.

#### Scenario: Dependency not merged
- **WHEN** issue 42 is `ready`, depends on issue 12, which is not merged, and a person runs `/relevo:go 42`
- **THEN** nothing is built, the report names issue 12, and issue 42 stays `ready` with no comment that says it is blocked

#### Scenario: Nothing for the queue to pick up
- **WHEN** that dependency merges later
- **THEN** the queue does not start issue 42, because nobody requested its build

### Requirement: A local build can take an issue that waits in the cloud
A local build SHALL be able to claim a `queued` issue: it passes the gates of a local build and the issue becomes `building` with `local`, so the queue no longer sees it. A `blocked` issue SHALL be refused, because its dependency is not merged.

#### Scenario: Queued for capacity
- **WHEN** issue 42 is `queued` because the limit of agents is reached and a person runs `/relevo:go 42`
- **THEN** the issue is built on that machine and the queue does not start it

#### Scenario: Blocked
- **WHEN** issue 42 is `blocked` and a person runs `/relevo:go 42`
- **THEN** nothing is built, the issue stays `blocked`, and the report names the dependency

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
