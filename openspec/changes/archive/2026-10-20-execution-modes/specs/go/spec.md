## ADDED Requirements

### Requirement: Without a credential the gate does not claim the issue
When the workflow tells the gate that no model credential exists, a `start` decision SHALL NOT claim the issue, SHALL NOT move its label and SHALL produce the local-run comment instead; every other decision SHALL be applied as usual.

#### Scenario: Start without credential
- **WHEN** the gates pass and no credential exists
- **THEN** the output action is `local`, the issue keeps `relevo:ready`, and the comment names `/relevo:go <n>`

#### Scenario: Other decisions
- **WHEN** the issue is blocked, needs a spec or is queued and no credential exists
- **THEN** the decision is applied as without the flag

### Requirement: The limits of a run are written once
The turn and cost limits and the closed lists of allowed and disallowed tools SHALL be produced by one function from `relevo.yml`, used by the local run, and the workflow template SHALL carry the same values, which a test compares.

#### Scenario: Template and local run agree
- **WHEN** the tool lists or the limits of the template and the shared function differ
- **THEN** a test fails
