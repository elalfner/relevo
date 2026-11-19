## ADDED Requirements

### Requirement: The configured OpenSpec guidance reaches the developer
When the repository's `openspec/config.yaml` sets a `context`, `rules` for `tasks`, or apply guidance, `go` SHALL give them to the developer agent explicitly, read from the output of `openspec instructions apply` and `openspec instructions tasks`. It SHALL NOT rely on the developer finding the file, and SHALL NOT copy them into the change's files.

#### Scenario: Config with a context
- **WHEN** `openspec/config.yaml` sets a `context` or rules for `tasks`
- **THEN** each developer launch is given that text as the project guidance, word for word

#### Scenario: Config with apply guidance
- **WHEN** the apply instructions carry operation guidance
- **THEN** the developer is given it along with the context and the rules

#### Scenario: No config
- **WHEN** the repository has no `openspec/config.yaml`, or it sets none of them
- **THEN** the developer is given no project guidance, only its default cost guide, and the report says so

#### Scenario: Retries get it too
- **WHEN** the developer is launched again in fix or integrate mode
- **THEN** it is given the same project guidance
