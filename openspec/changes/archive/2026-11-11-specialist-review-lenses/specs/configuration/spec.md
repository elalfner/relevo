## MODIFIED Requirements

### Requirement: Project rules are referenced, not copied
When `qa.rules_from` names a file, or a list of files, the `spec` lens SHALL read each of them at each run and treat their rules as binding. Every listed file SHALL be a protected path.

#### Scenario: Rules change
- **WHEN** the referenced rules file changes between two runs
- **THEN** the second run applies the new rules without any change to the agents

#### Scenario: Several rules files
- **WHEN** `qa.rules_from` is `[CLAUDE.md, .ai/rules/backend.md]`
- **THEN** the `spec` lens reads both, and a diff that touches either is refused as a protected path

#### Scenario: Missing file in the list
- **WHEN** a listed file does not exist
- **THEN** `doctor` warns and names it

## ADDED Requirements

### Requirement: The settings of the agents are configuration keys
`relevo.yml` MAY set `agents.dev.model`, `agents.dev.effort` and, for each lens, `agents.qa.<lens>.model` and `agents.qa.<lens>.effort`, with `<lens>` one of `spec`, `security`, `code` and `interface`. A model SHALL be a non-empty string. An effort SHALL be one of `low`, `medium`, `high`, `xhigh` and `max`. An unknown lens name or effort SHALL fail validation, and a file without the keys SHALL be valid.

#### Scenario: Valid settings
- **WHEN** the file sets a model and an effort for `agents.qa.security`
- **THEN** validation passes

#### Scenario: An unknown lens
- **WHEN** the file sets `agents.qa.style.model`
- **THEN** validation fails and names the lenses that exist

#### Scenario: An unknown effort
- **WHEN** an effort is `extreme`
- **THEN** validation fails and lists the efforts that exist

#### Scenario: No settings
- **WHEN** the file has none of the keys
- **THEN** it is valid and the defaults apply

### Requirement: Validation can warn without blocking
Validation SHALL have a level that reports a message without failing. A setting that is valid but that the agent in use does not apply SHALL produce a warning of that level and SHALL NOT be an error, so that a file can be shared between tools.

#### Scenario: A setting that Antigravity does not apply
- **WHEN** `agent.build` is `antigravity` and the file sets a model for a lens
- **THEN** validation passes and reports a warning that the setting is not applied with this agent

#### Scenario: A key that does not apply and is rejected
- **WHEN** a key is marked as rejected for the agent in use
- **THEN** validation still fails as it did before
