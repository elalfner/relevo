## ADDED Requirements

### Requirement: Doctor compares the only secret with the workflow's credential line
When exactly one of `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` exists and the credential line of `relevo-go.yml` that is not commented out names the other one, `doctor` SHALL warn and say which line to change. A workflow with neither line active SHALL NOT be judged.

#### Scenario: Subscription secret, API key line
- **WHEN** only `CLAUDE_CODE_OAUTH_TOKEN` exists and the active line of `relevo-go.yml` is `anthropic_api_key`
- **THEN** `doctor` warns that the build will fail with no credential and says to replace that line with `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`

#### Scenario: API key secret, subscription line
- **WHEN** only `ANTHROPIC_API_KEY` exists and the active line is `claude_code_oauth_token`
- **THEN** `doctor` warns and says to replace that line with `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`

#### Scenario: Secret and line agree
- **WHEN** the only secret is the one the active line names
- **THEN** `doctor` reports no mismatch

#### Scenario: Both secrets exist
- **WHEN** both secrets exist
- **THEN** `doctor` adds no mismatch warning and keeps the warning that names the line the workflow uses

#### Scenario: No secret
- **WHEN** neither secret exists
- **THEN** `doctor` gives the existing warning that the cloud cannot build and no mismatch warning

#### Scenario: No active line
- **WHEN** the workflow has neither credential line active, for example because the person edited it by hand
- **THEN** `doctor` does not warn about a mismatch

### Requirement: Init takes the credential from the secret when no answer is given
When the answers have no `credential`, `init` SHALL deduce it from the secret names it lists: only `CLAUDE_CODE_OAUTH_TOKEN` gives `subscription`, only `ANTHROPIC_API_KEY` gives `api_key`. With both or none it SHALL use the active credential line of an installed workflow, else assume `api_key` and say so in the plan. It SHALL NOT read a secret value.

#### Scenario: Only the token exists
- **WHEN** no `credential` answer is given and only `CLAUDE_CODE_OAUTH_TOKEN` exists
- **THEN** `init` writes the workflow with `claude_code_oauth_token` active and sets `limits.concurrent_agents` to 1

#### Scenario: Both secrets or none, no workflow
- **WHEN** no `credential` answer is given, both secrets exist or neither does, and no `go` workflow is installed
- **THEN** `init` assumes `api_key` and the plan says that it was assumed

#### Scenario: The secret outweighs an installed line
- **WHEN** no `credential` answer is given, only `CLAUDE_CODE_OAUTH_TOKEN` exists and the installed workflow has `anthropic_api_key` active
- **THEN** `init` takes `subscription` and plans the switch of the line

### Requirement: Init flags an answer that contradicts the only secret
When the `credential` answer is explicit and the only model secret that exists belongs to the other mode, `init` SHALL NOT report the credential as fine. The plan item SHALL name the secret that exists, the secret the answer needs, and the two ways out (change the answer, or store the other secret).

#### Scenario: API key answer, token secret
- **WHEN** the answer is `api_key` and only `CLAUDE_CODE_OAUTH_TOKEN` exists
- **THEN** the plan item for the model credential is a manual step that names both secrets, not an `ok`

#### Scenario: Matching answer
- **WHEN** the answer is `subscription` and `CLAUDE_CODE_OAUTH_TOKEN` exists
- **THEN** the plan item for the model credential is `ok`

### Requirement: Init switches the credential line of an installed workflow
When `relevo-go.yml` exists and the credential in force differs from its active credential line, the update of `init` SHALL switch that line, leaving the rest of the file as the merge gives it. A line the person already switched SHALL be kept unless an explicit answer or the only secret that exists asks for the other one.

#### Scenario: Switch an installed workflow
- **WHEN** `relevo-go.yml` has `anthropic_api_key` active and the credential in force is `subscription`
- **THEN** the plan offers the update with `claude_code_oauth_token` active and `anthropic_api_key` commented out, and shows the diff

#### Scenario: A subscription workflow is kept
- **WHEN** the person changed `relevo-go.yml` to `claude_code_oauth_token`, `init` runs again with no `credential` answer, and both secrets exist or neither does
- **THEN** the merge keeps `claude_code_oauth_token` active and reports no conflict

#### Scenario: Historical bases
- **WHEN** the closest published base is an older template
- **THEN** the base is rendered with the same credential as the current template, so the choice of the base does not change

### Requirement: The guide gives the command that stores a subscription token whole
Where `init` and the guide tell the person to store `CLAUDE_CODE_OAUTH_TOKEN`, they SHALL give the literal command `pbpaste | tr -d '[:space:]' | gh secret set CLAUDE_CODE_OAUTH_TOKEN` and say that `claude setup-token` prints the token over two lines and that an incomplete token gives the same authentication error as a missing one.

#### Scenario: The plan item
- **WHEN** the credential is `subscription` and no model secret exists
- **THEN** the manual item of the plan contains that command

#### Scenario: The guide in both languages
- **WHEN** `docs/get-started.md` and `docs/get-started.es.md` describe the subscription token
- **THEN** both contain that command

## MODIFIED Requirements

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
- **THEN** both is used, and the credential is taken from the secret that exists, or is an API key when that does not decide it
