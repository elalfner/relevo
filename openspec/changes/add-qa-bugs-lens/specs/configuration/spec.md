## MODIFIED Requirements

### Requirement: The settings of the agents are configuration keys
`relevo.yml` MAY set `agents.dev.model`, `agents.dev.effort` and, for each lens, `agents.qa.<lens>.model` and `agents.qa.<lens>.effort`, with `<lens>` one of `spec`, `security`, `code`, `interface` and `bugs`. A model SHALL be a non-empty string. An effort SHALL be one of `low`, `medium`, `high`, `xhigh` and `max`. An unknown lens name or effort SHALL fail validation, and a file without the keys SHALL be valid.

#### Scenario: Valid settings
- **WHEN** the file sets a model and an effort for `agents.qa.security`
- **THEN** validation passes

#### Scenario: Settings for the bugs lens
- **WHEN** the file sets a model and an effort for `agents.qa.bugs`
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

## ADDED Requirements

### Requirement: The mode of the bugs lens is a configuration key
`relevo.yml` MAY set `qa.bugs` to `advisory`, `blocking` or `off`. A file without the key SHALL be valid and SHALL mean `advisory`. Any other value SHALL fail validation and list the values that exist.

#### Scenario: A valid mode
- **WHEN** the file sets `qa.bugs` to `blocking`
- **THEN** validation passes

#### Scenario: No mode
- **WHEN** the file does not set `qa.bugs`
- **THEN** validation passes and the effective mode is `advisory`

#### Scenario: An unknown mode
- **WHEN** the file sets `qa.bugs` to `strict`
- **THEN** validation fails and lists `advisory`, `blocking` and `off`
