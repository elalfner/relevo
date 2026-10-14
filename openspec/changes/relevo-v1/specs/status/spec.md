## ADDED Requirements

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
