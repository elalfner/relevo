## ADDED Requirements

### Requirement: Status lists the ready issues the person can build themselves
When the cloud is not building (the go workflow is not installed or `RELEVO_CLOUD_GO` is `off`), `status` SHALL list the `ready` issues assigned to the person with the command `/relevo:go <n>` for each.

#### Scenario: Cloud paused
- **WHEN** `RELEVO_CLOUD_GO` is `off` and issue 42, assigned to the person, is `ready`
- **THEN** their status shows "42 ... → /relevo:go 42"

#### Scenario: Cloud building
- **WHEN** the cloud builds
- **THEN** no such section is shown

### Requirement: Status alerts about a build that stopped reporting
`status` SHALL alert about an issue on `building` whose last activity is older than `limits.building_alert_hours`, with the way to restart it: remove the `building` label and apply `ready` again, or run `/relevo:go <n>` on a machine.

#### Scenario: Stuck build
- **WHEN** an issue has been `building` with no activity for more than the configured hours
- **THEN** an alert names it, the hours, and how to restart it

#### Scenario: Recent activity
- **WHEN** the issue was updated within the configured hours
- **THEN** there is no alert
