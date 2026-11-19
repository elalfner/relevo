# Spec Delta

## ADDED Requirements

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
A local build SHALL pass the gates that protect the build: a valid approval, a milestone, an assignee, a complete text and merged dependencies. It SHALL NOT wait for the limit of concurrent agents or for the review capacity of the assignee. A file shared with an issue that is not merged SHALL NOT hold it: the build goes on and its hand-off lists the shared files.

#### Scenario: Limit of agents reached
- **WHEN** `limits.concurrent_agents` cloud builds are running and a person starts a local build
- **THEN** the local build starts

#### Scenario: Shared file
- **WHEN** issue 42 names a file that issue 40, built and not merged, also names, and a person starts a local build of 42
- **THEN** the build starts at once, and its hand-off message lists the file and issue 40

#### Scenario: Incomplete text
- **WHEN** the text of the issue lacks a required section and a person starts a local build
- **THEN** nothing is built and the issue goes to `needs-spec`, as it would in the cloud

### Requirement: A local build never joins the cloud queue
A local build that cannot start because it would have to wait SHALL report why and SHALL leave the labels of the issue as they were: it SHALL NOT move an issue to `queued` or `blocked`. A decision that sends the issue back to its writer (an incomplete text, an approval that is not valid, a missing milestone or assignee) SHALL be applied as in the cloud.

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

## MODIFIED Requirements

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
