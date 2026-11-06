# Spec Delta

## ADDED Requirements

### Requirement: An issue can ask for a model
An issue MAY carry a line `Model: <name>` for the developer and a line `QA-model: <name>` for the QA lenses. The check of the issue SHALL accept them and SHALL NOT count them as a missing section. `/relevo:issue` MAY propose a `Model:` line with the reason, and SHALL write it only when the person confirms the draft. The lines are part of the text of the issue, so the hash of the issue covers them.

#### Scenario: A line in a draft
- **WHEN** `/relevo:issue` proposes `Model: haiku` because the change copies a sibling screen
- **THEN** the draft shows the line and the reason, and the person can remove it before the issue is created

#### Scenario: The check of the issue
- **WHEN** an issue has `Model:` and `QA-model:` lines
- **THEN** the check passes as it would without them

#### Scenario: The hash
- **WHEN** a person edits the `Model:` line after `ready`
- **THEN** the hash of the issue changes and the run takes the path of an issue changed after `ready`
