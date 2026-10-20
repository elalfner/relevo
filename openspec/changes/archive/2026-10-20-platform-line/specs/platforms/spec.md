## ADDED Requirements

### Requirement: An issue belongs to one platform
An issue SHALL name its platform with a line `Platform: <name>`. When `relevo.yml` has one platform the line is optional and, if present, SHALL name that platform. When it has several the line is required and SHALL name one of them. Two lines naming different platforms SHALL be a problem. A feature that needs two platforms SHALL be two issues linked with `Depends-on:`.

#### Scenario: One platform, no line
- **WHEN** the repository has one platform and the issue has no `Platform:` line
- **THEN** the platform of the issue is that one

#### Scenario: Several platforms, line present
- **WHEN** the repository has `web` and `api` and the issue says `Platform: api`
- **THEN** the platform of the issue is `api`

#### Scenario: Several platforms, no line
- **WHEN** the repository has two platforms and the issue has no `Platform:` line
- **THEN** the platform cannot be resolved and the reason is that the line is missing, with the names of the platforms

#### Scenario: Unknown name
- **WHEN** the issue says `Platform: mobile` and no platform has that name
- **THEN** the platform cannot be resolved and the message names `mobile` and the platforms that exist

#### Scenario: Two different lines
- **WHEN** an issue says `Platform: web` and, elsewhere, `Platform: api`
- **THEN** the platform cannot be resolved and the message says the issue names two platforms

### Requirement: The platform of an issue can be read again later
A command SHALL be able to resolve the platform of an issue from its text at any later time, so that `fix` and `review` use the same profile `go` used.

#### Scenario: Fix after the build
- **WHEN** `fix` runs on an issue whose text says `Platform: api`
- **THEN** it resolves the platform `api` and the profile of its stack
