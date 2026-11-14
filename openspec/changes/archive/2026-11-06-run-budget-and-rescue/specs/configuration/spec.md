# Spec Delta

## ADDED Requirements

### Requirement: Run time limit setting
`relevo.yml` SHALL support `limits.run_max_minutes`, a whole number of at least 5 and by default 50: the minutes after which an unattended run starts no further agent. The decision that starts a run SHALL carry it. `/relevo:doctor` SHALL warn when the `timeout-minutes` of the build job of the installed go workflow is not at least five minutes above it.

#### Scenario: The default
- **WHEN** `limits.run_max_minutes` is absent
- **THEN** 50 is used

#### Scenario: An invalid value
- **WHEN** `limits.run_max_minutes` is not a whole number of at least 5
- **THEN** validation fails with a message that names the key and the minimum

#### Scenario: The setting is too close to the job timeout
- **WHEN** the build job has `timeout-minutes: 60` and `limits.run_max_minutes` is 58
- **THEN** `doctor` warns that the job would be cut before the guard acts and says how to fix it

#### Scenario: The setting leaves room
- **WHEN** the build job has `timeout-minutes: 60` and `limits.run_max_minutes` is 50
- **THEN** `doctor` reports nothing about it
