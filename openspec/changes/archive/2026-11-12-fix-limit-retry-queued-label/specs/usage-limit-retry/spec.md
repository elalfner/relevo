# Spec Delta

## ADDED Requirements

### Requirement: An issue returned to the queue ends with the queued label
When the final step returns an issue to the queue after a usage limit, the issue SHALL end with the `queued` label and with no other lifecycle label (`ready`, `building`, `qa-failed`). The result SHALL NOT depend on how the labels are edited: no single label edit adds and removes the same label.

#### Scenario: The issue was building
- **WHEN** a run ends at a usage limit that is retried and the issue was `building`
- **THEN** the issue has `queued` and none of `ready`, `building` or `qa-failed`, and the next queue pass can find it

#### Scenario: The labels were renamed
- **WHEN** the repository renamed its lifecycle labels in `relevo.yml` and a run ends at a usage limit that is retried
- **THEN** the issue ends with the renamed `queued` label and none of the other renamed lifecycle labels

#### Scenario: A label is never added and removed by one edit
- **WHEN** the label edits of the shipped workflow templates are read
- **THEN** no edit names the same label to add and to remove
