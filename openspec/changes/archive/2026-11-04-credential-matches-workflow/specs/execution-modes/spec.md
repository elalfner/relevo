## ADDED Requirements

### Requirement: The credential line of the go workflow agrees with the secret that exists
The secret that exists decides the mode, and the active credential line of the `go` workflow SHALL be the one for that mode. A repository where only one secret exists and the workflow uses the other SHALL be reported as a configuration error, because the cloud passes the build gate and the agent step then stops with no credential.

#### Scenario: Build with a mismatch
- **WHEN** only `CLAUDE_CODE_OAUTH_TOKEN` exists and the workflow passes only `anthropic_api_key`
- **THEN** `doctor` reports it before any build, naming the line to change

#### Scenario: Agreement
- **WHEN** the line and the secret are for the same mode
- **THEN** the mode is reported as before and nothing is added
