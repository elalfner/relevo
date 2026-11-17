# Spec Delta

## ADDED Requirements

### Requirement: Doctor reports a workflow that still starts on ready
`doctor` SHALL fail when the `go` workflow on the default branch starts on the `ready` label instead of the `go` label, with one result that names the file and points to `init`, because such a workflow builds every issue that is approved.

#### Scenario: Workflow of an earlier version
- **WHEN** `relevo-go.yml` on the default branch starts when `relevo:ready` is applied
- **THEN** `doctor` fails, names the file, says that approving an issue would start a build, and says to update the workflow with `/relevo:init`

#### Scenario: Current workflow
- **WHEN** the workflow starts when the effective `go` label is applied
- **THEN** `doctor` reports nothing about it

#### Scenario: Renamed go label
- **WHEN** `labels.go` is `team:build` and the workflow starts on `relevo:go`
- **THEN** `doctor` fails and names the label the workflow should start on

### Requirement: Doctor reports a local mark that marks nothing
`doctor` SHALL report, as a warning, the open issues that carry the `local` label without `building`, naming each, because the label then says nothing and a person may have applied it expecting an effect.

#### Scenario: Stray label
- **WHEN** issue 42 is `ready` and carries `relevo:local`
- **THEN** `doctor` warns, names issue 42, and says that the label is applied by a local build and does not keep the cloud from building

#### Scenario: Local build in progress
- **WHEN** issue 42 is `building` with `relevo:local`
- **THEN** `doctor` reports nothing about it

## MODIFIED Requirements

### Requirement: Doctor reports the execution mode
`doctor` SHALL report the credential mode deduced from the secret names (`api_key`, `subscription`, both as a warning, none as a warning that only local runs are possible), the state of the repository variable `RELEVO_CLOUD_GO`, a one-line reminder to read the current Anthropic policy on automated use of a subscription when the mode is `subscription`, and a warning when the mode is `subscription` and `limits.concurrent_agents` is more than 1. It SHALL say what the `go` label does in the repository: starts a cloud build, waits for the cloud to resume, only leaves a comment, or has no effect.

#### Scenario: Subscription with several agents
- **WHEN** only `CLAUDE_CODE_OAUTH_TOKEN` exists and `concurrent_agents` is 3
- **THEN** `doctor` warns that the quota is shared and suggests 1

#### Scenario: Cloud paused
- **WHEN** `RELEVO_CLOUD_GO` is `off`
- **THEN** `doctor` says the cloud is paused, that builds run locally, and that a `go` label waits until the cloud resumes

#### Scenario: No credential
- **WHEN** neither secret exists and the go workflow is installed
- **THEN** `doctor` warns that a `go` label will only produce the local-run comment

#### Scenario: No workflow
- **WHEN** the go workflow is not installed
- **THEN** `doctor` says that the `go` label has no effect and that approved issues are built with `/relevo:go <n>`
