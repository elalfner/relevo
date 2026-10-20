## ADDED Requirements

### Requirement: Design images setting
`relevo.yml` SHALL accept `design.images`, a boolean that defaults to `false`: pasted attachments are downloaded and shown to the model only when it is `true`. Files that are already in the repository do not depend on it.

#### Scenario: Default
- **WHEN** the file does not set it
- **THEN** `design.images` is `false`

#### Scenario: Invalid value
- **WHEN** `design.images` is `sometimes`
- **THEN** validation fails and names the setting
