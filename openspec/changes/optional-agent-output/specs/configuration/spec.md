## ADDED Requirements

### Requirement: Full agent output setting
`relevo.yml` SHALL support `run.full_output`, a boolean whose default is `false`, which turns on the redacted rendering of the agent output and the results in the transcript of a run that ends abnormally. It SHALL be refused with `trust: public`.

#### Scenario: Default
- **WHEN** `run.full_output` is not set
- **THEN** the full output is off and validation passes

#### Scenario: Not a boolean
- **WHEN** `run.full_output` is `"yes"`
- **THEN** validation fails and names the setting

#### Scenario: Public repository
- **WHEN** `run.full_output` is `true` and `trust` is `public`
- **THEN** validation fails
