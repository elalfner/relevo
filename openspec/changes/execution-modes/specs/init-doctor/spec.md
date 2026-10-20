## ADDED Requirements

### Requirement: Doctor reports the execution mode
`doctor` SHALL report the credential mode deduced from the secret names (`api_key`, `subscription`, both as a warning, none as a warning that only local runs are possible), the state of the repository variable `RELEVO_CLOUD_GO`, a one-line reminder to read the current Anthropic policy on automated use of a subscription when the mode is `subscription`, and a warning when the mode is `subscription` and `limits.concurrent_agents` is more than 1.

#### Scenario: Subscription with several agents
- **WHEN** only `CLAUDE_CODE_OAUTH_TOKEN` exists and `concurrent_agents` is 3
- **THEN** `doctor` warns that the quota is shared and suggests 1

#### Scenario: Cloud paused
- **WHEN** `RELEVO_CLOUD_GO` is `off`
- **THEN** `doctor` says the cloud is paused and that builds run locally

#### Scenario: No credential
- **WHEN** neither secret exists and the go workflow is installed
- **THEN** `doctor` warns that a `ready` label will only produce the local-run comment

### Requirement: Init asks where go runs and with which credential
`init` SHALL ask whether `go` builds in the cloud, on each person's machine or both (default both) and, for the cloud, with an API key or a subscription token. It SHALL generate the `go` workflow with the credential line for the chosen mode, install no `go` and queue workflows for a local-only setup, set `limits.concurrent_agents` to 1 for a subscription, and remind the person to create the secret without reading it.

#### Scenario: Subscription in the cloud
- **WHEN** the person chooses the cloud with a subscription token
- **THEN** the workflow uses `claude_code_oauth_token`, `concurrent_agents` is 1, and `init` shows how to create the token and store it as `CLAUDE_CODE_OAUTH_TOKEN`

#### Scenario: Local only
- **WHEN** the person chooses their own machines
- **THEN** `go` and queue workflows are not added, and the plan says to run `/relevo:go <n>` or `go-local.mjs <n>`

#### Scenario: Default
- **WHEN** the person gives no answer
- **THEN** both is used, with an API key
