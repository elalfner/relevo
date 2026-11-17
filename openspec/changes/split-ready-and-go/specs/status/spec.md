# Spec Delta

## ADDED Requirements

### Requirement: Status says when the go label has no effect
Where the cloud cannot build (the `go` workflow is not installed, no model credential exists, or `RELEVO_CLOUD_GO` is `off`), `status` SHALL say so once, with the reason, and SHALL list any `ready` issue that carries a `go` label as a request that nothing is answering.

#### Scenario: Request with no workflow
- **WHEN** the `go` workflow is not installed and issue 42 is `ready` with `go`
- **THEN** `status` says that the `go` label has no effect in this repository and shows "42 ... → /relevo:go 42"

#### Scenario: Request during a pause
- **WHEN** `RELEVO_CLOUD_GO` is `off` and issue 42 is `ready` with `go`
- **THEN** `status` says that the cloud is paused and that the request of issue 42 is served when it resumes

## MODIFIED Requirements

### Requirement: Status lists the ready issues the person can build themselves
`status` SHALL list the `ready` issues assigned to the person that carry no `go` label, whether or not the cloud builds, with the ways to build each: the command `/relevo:go <n>`, and the `go` label where the cloud can build.

#### Scenario: Cloud paused
- **WHEN** `RELEVO_CLOUD_GO` is `off` and issue 42, assigned to the person, is `ready`
- **THEN** their status shows "42 ... → /relevo:go 42" and does not offer the `go` label

#### Scenario: Cloud building
- **WHEN** the cloud builds and issue 42, assigned to the person, is `ready` with no `go` label
- **THEN** their status shows issue 42 with both ways to build it: `/relevo:go 42` and the `go` label

### Requirement: Status alerts about a build that stopped reporting
`status` SHALL alert about an issue on `building` whose last activity is older than `limits.building_alert_hours`. When the issue carries the `local` label the alert SHALL say that it is a local build and who started it. The alert SHALL give the way to restart it: return the issue to `ready` (which starts nothing), and then request the build with the `go` label or run `/relevo:go <n>` on a machine.

#### Scenario: Stuck build
- **WHEN** an issue has been `building` with no activity for more than the configured hours
- **THEN** an alert names it, the hours, and how to restart it

#### Scenario: Recent activity
- **WHEN** the issue was updated within the configured hours
- **THEN** there is no alert

#### Scenario: Stuck local build
- **WHEN** an issue has been `building` with `local`, applied by ana, with no activity for more than the configured hours
- **THEN** the alert says that it is a local build started by ana, and that returning it to `ready` starts nothing
