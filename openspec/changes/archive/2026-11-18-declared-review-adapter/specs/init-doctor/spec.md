# Spec Delta

## ADDED Requirements

### Requirement: Doctor checks a declared review adapter
For a platform whose repository profile declares the `api` adapter, `doctor` SHALL check that each tool in `review.needs` can be found and, when `docker` is listed, that the daemon answers, warning with the tool named when one is missing. It SHALL report an unresolvable declaration as an invalid profile naming the key, and SHALL NOT install or start anything.

#### Scenario: Missing tool
- **WHEN** `review.needs` lists `nhost` and the tool cannot be found
- **THEN** `doctor` warns, names `review.needs` and `nhost`, and gives the way to install it

#### Scenario: Docker stopped
- **WHEN** `review.needs` lists `docker`, the CLI is installed and the daemon does not answer
- **THEN** `doctor` warns that the engine is stopped and says to start it

#### Scenario: Remote target
- **WHEN** `review.test` of a declared adapter contains a URL whose host is not local
- **THEN** `doctor` reports the profile as invalid and names `review.test`

#### Scenario: Missing test
- **WHEN** a profile sets `adapter: api` and no `test`
- **THEN** `doctor` reports the profile as invalid and names `review.test`

#### Scenario: Everything in place
- **WHEN** the declaration is valid, every tool of `review.needs` is found and the daemon answers
- **THEN** `doctor` passes the check of that platform and says the review is declared by the repository

#### Scenario: No declared adapter
- **WHEN** no platform declares an adapter
- **THEN** `doctor` adds none of these checks

### Requirement: Doctor says what a declared adapter can and cannot prove
For a declared adapter with `review.autopilot` `precheck` or `verify`, `doctor` SHALL note that the agent marks no line by itself when `review.test` has no `{filter}`, and SHALL otherwise pass the autopilot check. It SHALL warn when the repository's profile of a shipped stack sets `review.adapter` or `review.needs`, because they are ignored.

#### Scenario: No filter
- **WHEN** `review.autopilot` is `verify` and the declared `review.test` has no `{filter}`
- **THEN** `doctor` notes that the agent will mark no line by itself and that the whole suite runs once at the end

#### Scenario: Autopilot with a filter
- **WHEN** `review.autopilot` is `precheck` and the declared `review.test` has `{filter}`
- **THEN** `doctor` passes the autopilot check of that platform and says the agent proves a line by running the test that covers it

#### Scenario: Autopilot off
- **WHEN** `review.autopilot` is `off` and a platform declares the adapter
- **THEN** `doctor` adds no autopilot check for it

#### Scenario: Ignored declaration on a shipped stack
- **WHEN** the repository's profile of `laravel` sets `review.adapter`
- **THEN** `doctor` warns that the plugin's adapter is used and the setting is ignored
