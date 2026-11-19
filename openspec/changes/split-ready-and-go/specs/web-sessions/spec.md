# Spec Delta

## ADDED Requirements

### Requirement: Go does not build in a remote session
In a remote session, `/relevo:go <issue>` SHALL build nothing and claim nothing. It SHALL say why and ask one yes/no question: whether to apply the `go` label so that the cloud builds the issue. It SHALL apply the label only on a clear yes, to a `ready` issue, when the person has the permission of `ready`. No option SHALL force a build there. A run that the workflow starts with its decision is not a remote session.

#### Scenario: Approved issue, cloud available
- **WHEN** a person runs `/relevo:go 42` in a remote session, issue 42 is `ready` and the cloud can build
- **THEN** nothing is built, the skill explains why and asks whether to apply `go` to issue 42, and applies it only after a yes

#### Scenario: The cloud cannot build
- **WHEN** the `go` workflow is not installed, has no credential or is paused
- **THEN** the skill applies nothing and says that the issue needs a machine or the cloud

#### Scenario: Draft
- **WHEN** issue 42 has no lifecycle label
- **THEN** the skill applies nothing and says that the issue needs `ready` first

#### Scenario: Local flag
- **WHEN** a person runs `/relevo:go 42 --local` in a remote session
- **THEN** the answer is the same: nothing is built there
