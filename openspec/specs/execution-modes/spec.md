# execution-modes Specification

## Purpose
TBD - created by archiving change execution-modes. Update Purpose after archive.

## Requirements

### Requirement: Where go builds is decided by what is installed, not by a setting
Whether `go` builds in the cloud, on a person's machine or both SHALL follow from the workflow files that are installed, the model credential that exists as a repository secret and the repository variable `RELEVO_CLOUD_GO`, and `relevo.yml` SHALL have no setting for it. With nothing changed the default SHALL be both.

#### Scenario: Both
- **WHEN** the `go` workflow is installed, a credential secret exists and the variable is not set
- **THEN** a `ready` label starts a cloud build, and a person can still run `/relevo:go <n>` on their machine

#### Scenario: Local only
- **WHEN** the `go` and queue workflows are not installed
- **THEN** nothing builds in the cloud and `/relevo:go <n>` works as usual

### Requirement: A variable pauses the cloud at once
With the repository variable `RELEVO_CLOUD_GO` set to `off`, a `ready` label SHALL start no cloud build and the queue SHALL dispatch none. Changing the variable SHALL need no change to any file.

#### Scenario: Paused
- **WHEN** `RELEVO_CLOUD_GO` is `off` and an issue is labelled `ready`
- **THEN** no workflow run builds it, and the issue stays `ready` for a local run

#### Scenario: Resumed
- **WHEN** the variable is deleted or set to anything else
- **THEN** the next `ready` label or queue run builds in the cloud again

### Requirement: A cloud without a credential falls back instead of failing
When neither `ANTHROPIC_API_KEY` nor `CLAUDE_CODE_OAUTH_TOKEN` exists, the gate SHALL NOT claim the issue or start the build job. It SHALL leave the issue `ready` and comment that the cloud is not configured, naming `/relevo:go <n>` for a local run and the two secrets for the cloud.

#### Scenario: No credential
- **WHEN** a person labels an issue `ready` in a repository with the `go` workflow and no model credential
- **THEN** the issue stays `ready`, the build job does not run, and one comment says what to do

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
When a cloud run ends because the usage limit, the quota or the credit was reached, the final step SHALL say so and say to apply `ready` again later, instead of the generic "ended without a result".

#### Scenario: Limit reached
- **WHEN** the execution log of the failed run shows that a usage limit was reached: its final result is an error whose text says so, or a rate-limit event has a status other than `allowed`
- **THEN** the issue is marked `qa-failed` as for any failure and the comment says the usage limit was reached and to label the issue `ready` again later

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

### Requirement: A local run can be started from the go command
`/relevo:go <issue> --local` SHALL run `go-local.mjs` for the issue and stop, instead of building in the interactive session, so that the build runs in its own process with the closed tool lists of the workflow, which an interactive session does not have.

#### Scenario: Local flag
- **WHEN** the person runs `/relevo:go 42 --local`
- **THEN** the skill runs `go-local.mjs 42`, shows its output and does not build in the session

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

### Requirement: The credential line of the go workflow agrees with the secret that exists
The secret that exists decides the mode, and the active credential line of the `go` workflow SHALL be the one for that mode. A repository where only one secret exists and the workflow uses the other SHALL be reported as a configuration error, because the cloud passes the build gate and the agent step then stops with no credential.

#### Scenario: Build with a mismatch
- **WHEN** only `CLAUDE_CODE_OAUTH_TOKEN` exists and the workflow passes only `anthropic_api_key`
- **THEN** `doctor` reports it before any build, naming the line to change

#### Scenario: Agreement
- **WHEN** the line and the secret are for the same mode
- **THEN** the mode is reported as before and nothing is added

### Requirement: The consumption of a run is shown by agent and by model
When the execution log has them, the comment about a cloud run SHALL list for the main agent and each subagent its model, effort, turns, minutes, tokens and an estimated cost, and SHALL give the real cost of each model. The cost of an agent SHALL be written as an estimate. The hidden marker of the comment SHALL carry the same figures under `agents` and `models`. A figure the log does not have SHALL be left out, and a log with none of these figures SHALL give the comment it gives today.

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
