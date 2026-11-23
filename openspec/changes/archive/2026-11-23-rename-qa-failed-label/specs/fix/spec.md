# Spec Delta

## MODIFIED Requirements

### Requirement: State is preserved
After a successful fix the issue SHALL keep its current state (`in-review`, `build-failed` returns to `built`, or `changes-requested` returns to `pr-open`), and a comment SHALL summarise the change, the QA verdict and the commit.

#### Scenario: Fix after qa-failed
- **WHEN** a fix on a `build-failed` issue passes QA
- **THEN** the issue becomes `built` and the assignee is notified

#### Scenario: Fix after requested changes
- **WHEN** a fix addresses requested changes on an open pull request
- **THEN** the issue returns to `pr-open` and the reviewer is re-requested
