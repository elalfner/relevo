## ADDED Requirements

### Requirement: Secrets are redacted from the agent's output that a run prints or saves
Anything a workflow prints or saves from the agent's execution log SHALL pass through a redactor that replaces known secret shapes (provider and cloud keys, access tokens, private key blocks, credentials inside URLs, bearer values, and the value of an assignment whose name is a credential name) and the exact value of each secret the job holds, including the model credential and the workflow token. The redactor SHALL work on text only and SHALL NOT open a restricted file. A result that cannot be parsed SHALL be dropped, not printed as it is.

#### Scenario: A secret the job holds
- **WHEN** the agent's output contains the value of `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`
- **THEN** the rendering and the transcript show a placeholder instead

#### Scenario: The content of a restricted file
- **WHEN** the output holds lines shaped like an environment file, a private key, a `.npmrc` token, a `.git-credentials` URL, a `.pgpass` line, a `key.properties` password or a Google service key
- **THEN** none of those values appears in the rendering or the transcript

#### Scenario: A secret nobody knows
- **WHEN** the output holds a credential in a shape the redactor does not know
- **THEN** it can appear, which is why the option is off by default and its documentation says so

### Requirement: The full output is refused for a public repository
When `trust` is `public`, the system SHALL refuse the full output: validation fails when `run.full_output` is set, a `full_output` input of a manual start is ignored with a notice, and no transcript of a run is saved as an artifact.

#### Scenario: Setting with trust public
- **WHEN** `relevo.yml` sets `run.full_output: true` and `trust: public`
- **THEN** validation fails with a message that says why

#### Scenario: Manual start in a public repository
- **WHEN** a person starts a run with `full_output` true and `trust` is `public`
- **THEN** the log has no rendering of the agent output and says it was refused

### Requirement: The redactor is not a control
The documentation SHALL say that the redactor reduces the chance that a secret reaches a log or an artifact and does not replace the controls that keep secrets from the agent (the closed tool list, the restricted-file denials, the absence of web access). The workflow template SHALL NOT set the action's `show_full_output` or `allowed_non_write_users`.

#### Scenario: Template check
- **WHEN** the active lines of `relevo-go.yml` are read
- **THEN** `show_full_output` is not among the inputs of the action
