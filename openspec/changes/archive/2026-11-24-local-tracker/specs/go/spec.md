# Spec Delta

## ADDED Requirements

### Requirement: Go reads and moves the issue through the tracker
`/relevo:go` SHALL read the issue, check its gates, claim it and record its outcome through the tracker of the project, so that with `tracker: files` it reads the file and the state record and with `tracker: github` it does what the other requirements of this capability describe. The gates that belong to a team (milestone, assignee, review capacity) SHALL apply only to `github`.

#### Scenario: Files project
- **WHEN** `/relevo:go 3` runs in a files project with issue 3 `ready` and its hash unchanged
- **THEN** it claims the issue as `building`, builds it in a worktree and leaves it `built` or `build-failed`

#### Scenario: GitHub project
- **WHEN** it runs in a GitHub project
- **THEN** its behavior is the one it had before this change

### Requirement: A hand-off in a files project is a local branch
When a build ends in a hand-off in a files project, the result SHALL be the branch of the issue with its commits, the state `built` and a hand-off report recorded in the state of the issue, and no pull request, comment on GitHub or push SHALL be attempted.

#### Scenario: Built
- **WHEN** QA passes
- **THEN** the branch exists locally, the issue is `built` and the report names the branch and what the run used

### Requirement: A run of go in a files project can be local only
`go` in a files project SHALL always build on the machine; the `go` label, the cloud workflows and `RELEVO_CLOUD_GO` SHALL NOT apply, and `/relevo:go` SHALL NOT warn that the cloud may build the same issue.

#### Scenario: No cloud
- **WHEN** a person runs `/relevo:go 3 --local` in a files project
- **THEN** the build runs as `go-local.mjs` does and no message mentions the cloud
