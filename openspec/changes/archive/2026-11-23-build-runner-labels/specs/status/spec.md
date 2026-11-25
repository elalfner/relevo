# Spec Delta

## ADDED Requirements

### Requirement: Status tells a build that waits for a runner from one that stopped
When an issue has been `building` longer than `limits.building_alert_hours` and its build job has not started, `status` SHALL report it as waiting for a runner, with the hours, and SHALL NOT report it as a build that stopped reporting. It SHALL say what to do: look at the build runners, or build the issue on a machine. It SHALL NOT tell the person to restart the build.

#### Scenario: Long wait
- **WHEN** issue 42 was claimed four hours ago, the alert time is 3 hours and its build job has not started
- **THEN** `status` says that issue 42 has waited four hours for a runner and gives the two ways forward

#### Scenario: Short wait
- **WHEN** the issue has waited less than the alert time
- **THEN** there is no alert

#### Scenario: A build that started and went silent
- **WHEN** the build job started and the issue has had no activity for longer than the alert time
- **THEN** the alert is the one of a build that stopped reporting
