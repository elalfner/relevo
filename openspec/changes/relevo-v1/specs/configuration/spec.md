## ADDED Requirements

### Requirement: Per-repository configuration file
Relevo SHALL read its behaviour from a `relevo.yml` file at the repository root. Skills SHALL NOT hard-code values that the file defines.

#### Scenario: Skill reads configuration
- **WHEN** any Relevo command starts in a repository that has `relevo.yml`
- **THEN** it loads the file and uses its values for branches, review mode, limits, evidence policy, labels and language

#### Scenario: Missing configuration
- **WHEN** a Relevo command other than `init` starts and `relevo.yml` does not exist
- **THEN** it stops and tells the user to run `/relevo:init`

### Requirement: Repository and team settings
`relevo.yml` SHALL support `branches.base`, `branches.release`, `tracker`, `git_provider`, `platform`, `team.members`, `team.spec_writer` and `team.approvers` (used by `roles`).

#### Scenario: Team and branches set
- **WHEN** `relevo.yml` sets `branches.base`, `team.members` and `team.spec_writer`
- **THEN** validation passes and the commands use those values

### Requirement: Review and limit settings
`relevo.yml` SHALL support `review.mode` (`none`, `peer`, `roles`), `review.merger` (`author`, `approver`), `limits.built_unreviewed_per_person`, `limits.concurrent_agents`, `limits.review_sla_hours`, `limits.run_max_turns` and `limits.run_max_cost`.

#### Scenario: Review mode set
- **WHEN** `review.mode` is `peer` and `review.merger` is `approver`
- **THEN** validation passes and `ship` applies the peer rules

### Requirement: Quality and presentation settings
`relevo.yml` SHALL support `qa.retries`, `qa.rules_from`, `evidence.policy` (`attach_to_pr`, `local_only`), `labels`, `language` and `trust` (`private-team`, `public`).

#### Scenario: Evidence kept local
- **WHEN** `evidence.policy` is `local_only`
- **THEN** validation passes and captures are not attached to pull requests

### Requirement: Defaults and validation
Optional settings SHALL have documented defaults, `limits.run_max_cost` SHALL be mandatory, and invalid values SHALL be rejected with an actionable message.

#### Scenario: Defaults
- **WHEN** an optional setting is absent
- **THEN** the documented default is used: base `dev`, release `main`, `review.mode` `peer`, `review.merger` `approver`, `built_unreviewed_per_person` 2, `concurrent_agents` 3, `review_sla_hours` 8, `run_max_turns` 100, `qa.retries` 1, `evidence.policy` `attach_to_pr`, `language` `en`, `trust` `private-team`

#### Scenario: Cost limit is mandatory
- **WHEN** `limits.run_max_cost` is absent
- **THEN** validation fails and unattended runs do not start, because an unattended agent must always have a cost limit

#### Scenario: Invalid value
- **WHEN** a setting has a value outside its allowed set
- **THEN** validation fails and names the setting, the value and the allowed values

### Requirement: Message language
When `language` is set, hand-off messages, digests and prompts SHALL be produced in that language. Label names are unaffected by `language` and are changed only through `labels`.

#### Scenario: Spanish messages
- **WHEN** `language` is `es`
- **THEN** hand-off messages are written in Spanish while label names stay as configured

### Requirement: Secrets never live in configuration
`relevo.yml` SHALL NOT contain API keys or tokens. Credentials SHALL come from the repository's secret store.

#### Scenario: Secret detected in configuration
- **WHEN** validation finds a value that looks like a credential in `relevo.yml`
- **THEN** it fails and tells the user to move the value to the secret store

### Requirement: Project rules are referenced, not copied
When `qa.rules_from` names a file, the QA agent SHALL read that file at each run and treat its rules as binding.

#### Scenario: Rules change
- **WHEN** the referenced rules file changes between two runs
- **THEN** the second run applies the new rules without any change to the agents
