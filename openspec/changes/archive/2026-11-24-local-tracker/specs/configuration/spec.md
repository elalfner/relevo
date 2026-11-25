# Spec Delta

## ADDED Requirements

### Requirement: The tracker and the provider accept a local value and must agree
`tracker` SHALL accept `github` and `files`, and `git_provider` SHALL accept `github` and `local`. The pair SHALL be `github` with `github` or `files` with `local`; any other pair SHALL fail validation with a message that names both keys. The defaults SHALL stay `github`.

#### Scenario: Local pair
- **WHEN** `tracker` is `files` and `git_provider` is `local`
- **THEN** validation passes

#### Scenario: Mixed pair
- **WHEN** `tracker` is `files` and `git_provider` is `github`
- **THEN** validation fails and says that `files` goes with `local`

### Requirement: A files project is a project of one person
With `tracker: files`, `review.mode` SHALL be `none`, and `team.*`, `limits.built_unreviewed_per_person`, `limits.concurrent_agents` above 1 and `runner.*` SHALL be ignored with a warning that says why, never an error, so that a project can change tracker without editing the file.

#### Scenario: Review mode peer
- **WHEN** `tracker` is `files` and `review.mode` is `peer`
- **THEN** validation fails and says that a files project has no reviewer

#### Scenario: Team set
- **WHEN** `team.members` is set in a files project
- **THEN** validation passes with a warning that it is ignored

### Requirement: Depth is validated like any other setting
`depth` SHALL be validated as an enum of `prototype` and `standard` with the default `standard`, and an unknown value SHALL name the allowed ones, as every other enum does.

#### Scenario: Valid value
- **WHEN** `depth` is `prototype`
- **THEN** validation passes
