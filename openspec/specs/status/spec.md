# status Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: Per-person view
`status` SHALL show the person invoking it: the issues waiting on them (with the command to run), the pull requests they must review, and the issues waiting on others.

#### Scenario: Assignee view
- **WHEN** an assignee runs `status`
- **THEN** their `built` issues appear first with their next command, then pull requests awaiting their review, then their issues waiting on a peer

### Requirement: Spec writer view
For the spec writer, `status` SHALL emphasise what blocks them: issues in `needs-spec`, `blocked`, `needs-reviewer`, and the progress of the current milestone.

#### Scenario: Returned specs
- **WHEN** the spec writer runs `status`
- **THEN** issues in `needs-spec` and `blocked` are listed before anything else

### Requirement: Milestone summary and capacity
`status` SHALL summarise the milestone (merged, in review, queued) and SHALL warn when the queued work exceeds what the team can review in the milestone's remaining time.

#### Scenario: Overloaded milestone
- **WHEN** queued plus in-flight issues exceed the review capacity before the milestone due date
- **THEN** a capacity warning is shown

#### Scenario: Milestone without a due date
- **WHEN** the milestone has no due date
- **THEN** no capacity warning is computed and `status` says the milestone has no due date

### Requirement: Alerts
`status` SHALL alert on reviews past `limits.review_sla_hours` and on feature branches that have fallen behind the base branch.

#### Scenario: Stale review
- **WHEN** a pull request has waited longer than the SLA
- **THEN** it appears under alerts with its age

### Requirement: Daily digest
A scheduled workflow SHALL post the team-level status to a configured channel once per working day. It SHALL contain only who is waiting on what and the alerts.

#### Scenario: Digest posted
- **WHEN** the scheduled time arrives on a working day
- **THEN** one digest is posted, and nothing is posted when there is nothing waiting

### Requirement: Read-only
`status` SHALL NOT change any issue, label or branch.

#### Scenario: Running status
- **WHEN** `status` runs
- **THEN** no write operation is performed

### Requirement: Status shows what blocks an issue from another repository
For each blocked issue, `status` SHALL show the references it waits for and, for an external one, whether it is open, in which Relevo state when the other repository labels its issues, and whether it could not be read.

#### Scenario: Waiting on the back
- **WHEN** issue 7 of the front is blocked by `acme/api#12`, which is open and labelled `relevo:in-review`
- **THEN** the blocked section shows "#7 ... waiting for acme/api#12 (in-review)"

#### Scenario: Unreadable
- **WHEN** the external issue cannot be read
- **THEN** the line says it could not be read instead of a state

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
