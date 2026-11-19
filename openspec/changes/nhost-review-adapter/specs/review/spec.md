# Spec Delta

## ADDED Requirements

### Requirement: The plugin ships an api adapter for Nhost
The plugin SHALL ship the generic `api` adapter of a declared adapter for the stack `nhost` (no targets), with the tools `docker` and `npm` and the `log` and `test` of its profile, so a platform with that stack reviews with no `review` block. The stop message for a stack with no adapter SHALL name `nhost` among the adapters that exist.

#### Scenario: Nhost with no review block
- **WHEN** the platform has the stack `nhost`, which defines no targets, and the repository has no `review` block for it
- **THEN** the adapter is `api` with the plugin's `log`, `test` and `needs`, and the review does not need `review.autopilot` other than `off`

#### Scenario: Stop message
- **WHEN** a stack has no adapter
- **THEN** the message lists `nhost` among the adapters that exist

#### Scenario: Nhost with the repository's test command
- **WHEN** the repository's profile of `nhost` sets `review.test` to `npm run --silent test:integration`
- **THEN** the adapter runs that command, and no line is proved one by one because it has no `{filter}`

#### Scenario: Remote address in the override
- **WHEN** the repository's profile of `nhost` sets `review.test` to a command with `https://db.example.com/`
- **THEN** the review stops before changing anything and names `review.test`

#### Scenario: A repository cannot relabel the adapter
- **WHEN** the repository's profile of `nhost` sets `review.needs` or `review.adapter`
- **THEN** the review ignores them and `doctor` warns, as for any shipped stack
