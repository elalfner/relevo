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
- **WHEN** the execution log of the failed run shows that a usage limit was reached
- **THEN** the issue is marked `qa-failed` as for any failure and the comment says the usage limit was reached and to label the issue `ready` again later

#### Scenario: Another failure
- **WHEN** the run failed for any other reason
- **THEN** the comment is the generic one with the link to the run

### Requirement: The consumption of a run is visible
After a cloud run, a comment on the issue SHALL give the number of turns, the cost and the tokens that the execution log reports, and say that the cost is notional when the mode is a subscription. When the log reports none of them, nothing SHALL be posted.

#### Scenario: Log with usage
- **WHEN** the execution log has a result with turns, cost and token counts
- **THEN** one comment states them

#### Scenario: Log without usage
- **WHEN** the execution log is missing or has no result
- **THEN** no comment is posted and the run is not reported as failed

### Requirement: A local run uses the same limits and tools as the cloud
`go-local.mjs <issue>` SHALL run `/relevo:go <issue>` with `claude -p` on the person's machine, with the turn and cost limits of `relevo.yml` and the closed lists of allowed and disallowed tools that the workflow uses, written by one shared function. It SHALL warn when the cloud is also able to build the issue.

#### Scenario: Local build
- **WHEN** the person runs `go-local.mjs 42`
- **THEN** a worktree is created from the base branch, `claude -p "/relevo:go 42"` runs there with the flags of the workflow, and on a clean end the worktree is removed

### Requirement: A local run can be started from the go command
`/relevo:go <issue> --local` SHALL run `go-local.mjs` for the issue and stop, instead of building in the interactive session, because the interactive session has neither the closed tool lists nor a worktree of its own.

#### Scenario: Local flag
- **WHEN** the person runs `/relevo:go 42 --local`
- **THEN** the skill runs `go-local.mjs 42`, shows its output and does not build in the session

### Requirement: A local run has its own working tree
`go-local.mjs` SHALL run in a separate `git worktree` outside the repository's working tree, so that the person's uncommitted changes do not stop it, SHALL remove the worktree when the run ends cleanly and SHALL keep it, printing its path, otherwise.

#### Scenario: Uncommitted changes in the repository
- **WHEN** the working tree of the repository has uncommitted changes
- **THEN** the local run is not affected, because it works in its own worktree

#### Scenario: Run fails
- **WHEN** the local run ends with an error
- **THEN** the worktree stays for inspection and its path is printed

#### Scenario: Cloud can also build it
- **WHEN** the go workflow is installed, a credential exists and the variable is not `off`
- **THEN** the command warns that the cloud may start the same issue and suggests setting `RELEVO_CLOUD_GO` to `off`

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
