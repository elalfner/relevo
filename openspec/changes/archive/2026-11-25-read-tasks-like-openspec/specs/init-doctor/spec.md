# Spec Delta

## ADDED Requirements

### Requirement: Doctor checks the schema of the OpenSpec project
`doctor` SHALL read the default schema of `openspec/config.yaml` and SHALL report a failure, with its fix, when it is not `spec-driven`, because the build reads `tasks.md` as that schema defines it. A project with no `schema` line SHALL be judged by OpenSpec's own default. A configuration that cannot be read, or whose `schema:` line has no usable name, SHALL be reported as unreadable, never as a pass.

#### Scenario: The supported schema
- **WHEN** `openspec/config.yaml` declares `schema: spec-driven`
- **THEN** the check passes

#### Scenario: Another schema
- **WHEN** `openspec/config.yaml` declares a schema other than `spec-driven`
- **THEN** the report shows a failure naming the schema, with the fix of setting `schema: spec-driven`

#### Scenario: Unreadable configuration
- **WHEN** `openspec/config.yaml` cannot be read, or its `schema:` line has no usable name
- **THEN** the report says the schema could not be read, and does not show a pass
