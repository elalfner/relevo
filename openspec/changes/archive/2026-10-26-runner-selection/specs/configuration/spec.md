## ADDED Requirements

### Requirement: Runner setting
`relevo.yml` SHALL support `runner.labels`, a non-empty list of strings naming the runner that every Relevo workflow runs on. When it is absent the runner SHALL be `ubuntu-latest`. Validation SHALL reject an empty list, an entry that is not a non-empty string, and a value that is not a list.

#### Scenario: Default runner
- **WHEN** `relevo.yml` has no `runner` key
- **THEN** validation passes and the runner is `ubuntu-latest`

#### Scenario: Self-hosted runner with labels
- **WHEN** `runner.labels` is `[self-hosted, Front]`
- **THEN** validation passes and the workflows run on a runner that has both labels

#### Scenario: Empty list
- **WHEN** `runner.labels` is `[]`
- **THEN** validation fails and says the list needs at least one label

#### Scenario: A single string
- **WHEN** `runner.labels` is `self-hosted`
- **THEN** validation fails and says it must be a list of labels

### Requirement: The runner setting holds no persistence flag
`relevo.yml` SHALL NOT define a setting that declares a runner ephemeral or persistent. Relevo SHALL treat every runner as one that may persist between jobs.

#### Scenario: A persistence key
- **WHEN** `relevo.yml` sets `runner.ephemeral`
- **THEN** validation fails and says that the key does not exist and that Relevo assumes a runner persists
