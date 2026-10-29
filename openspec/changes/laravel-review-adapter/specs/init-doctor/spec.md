# Spec Delta

## ADDED Requirements

### Requirement: Doctor checks what an api review needs
For each platform whose stack has the `api` review adapter, `doctor` SHALL check that PHP and Composer can be found, that `vendor/` exists, and the database the test configuration declares, without reading the real environment files. It SHALL warn, with the command to fix it, when one is missing, and SHALL note a test database that is not in-memory SQLite, because the review needs the person's confirmation before it runs a test.

#### Scenario: Laravel without dependencies
- **WHEN** a Laravel platform has no `vendor/`
- **THEN** `doctor` warns and gives the Composer command to install them

#### Scenario: Database in the test configuration
- **WHEN** the test configuration declares a MySQL connection
- **THEN** `doctor` notes it and says the review asks for confirmation before it runs tests

#### Scenario: Not a Laravel platform
- **WHEN** no platform has the `api` adapter
- **THEN** `doctor` adds none of these checks

### Requirement: Doctor checks the review block of a profile
`doctor` SHALL warn when the resolved profile of a platform has a `review` block that is invalid, a `serve` whose command is not on the base branch, a `log` that matches no file and whose directory does not exist, or text in the section `Review` that asks for what the block cannot change. It SHALL list which `review` keys the repository replaced.

#### Scenario: Log path that matches nothing
- **WHEN** `review.log` is `var/log/app.log` and neither the file nor `var/log` exists
- **THEN** `doctor` warns and names the setting

#### Scenario: Keys replaced
- **WHEN** the repository replaced `review.test`
- **THEN** `doctor` lists it as a note, not a failure

#### Scenario: Text that asks to skip the audit
- **WHEN** the section `Review` tells the agent to skip the audit
- **THEN** `doctor` warns that the review ignores it
