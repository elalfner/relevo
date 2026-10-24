# Spec Delta

## MODIFIED Requirements

### Requirement: Review events update the label
A workflow reacting to pull request review events SHALL keep the lifecycle label in sync: a review that requests changes sets `changes-requested` and mentions the author; a new push or fix that addresses them returns the issue to `pr-open`.

#### Scenario: Changes requested
- **WHEN** a reviewer submits a review requesting changes on an open pull request
- **THEN** the issue is labelled `changes-requested` and the author is mentioned with the reviewer's summary

#### Scenario: Approval
- **WHEN** a reviewer approves
- **THEN** the issue stays `pr-open` and the person who will run `ship` is mentioned, with both ways to ship: applying the `ship` label when the ship workflow is installed, or running `/relevo:ship <n>`

## ADDED Requirements

### Requirement: The ship label is a request, not a state
The lifecycle SHALL have a `ship` label (default name `relevo:ship`) that asks for an unattended ship. It SHALL be added next to `pr-open` and SHALL NOT replace it, it SHALL be renamable in `labels` like the others, and every ship run SHALL remove it whether it merges or stops.

#### Scenario: Label applied
- **WHEN** a person applies `relevo:ship` to a `pr-open` issue
- **THEN** the issue has both labels until the run ends

#### Scenario: Run ends
- **WHEN** the run merges or stops
- **THEN** `relevo:ship` is no longer on the issue
