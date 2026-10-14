## ADDED Requirements

### Requirement: Specification first
`fix` SHALL update the change's specification, design and task list to describe the corrected behaviour before any code is written, and the main session SHALL NOT edit application code.

#### Scenario: New feedback
- **WHEN** the person describes a defect
- **THEN** a scenario describing the correct behaviour is added to the specification and a corrections section with unchecked tasks is appended to the task list, before the developer agent runs

### Requirement: Rules are not rewritten to fit
If the reported defect is actually a violation of a project rule, `fix` SHALL say so and SHALL NOT change the rule.

#### Scenario: Rule violation
- **WHEN** the defect is a breach of a rule in `qa.rules_from`
- **THEN** the fix restores compliance with the rule

### Requirement: Developer and QA with one retry
`fix` SHALL delegate to the developer agent only the new tasks, then run QA on the iteration's diff against the new scenarios, with `qa.retries` retries.

#### Scenario: Rejected twice
- **WHEN** QA still rejects after the retries
- **THEN** no commit or push is made, the changes are kept, and the person is told the findings

### Requirement: State is preserved
After a successful fix the issue SHALL keep its current state (`in-review`, `qa-failed` returns to `built`, or `changes-requested` returns to `pr-open`), and a comment SHALL summarise the change, the QA verdict and the commit.

#### Scenario: Fix after qa-failed
- **WHEN** a fix on a `qa-failed` issue passes QA
- **THEN** the issue becomes `built` and the assignee is notified

#### Scenario: Fix after requested changes
- **WHEN** a fix addresses requested changes on an open pull request
- **THEN** the issue returns to `pr-open` and the reviewer is re-requested

### Requirement: Safe commit
`fix` SHALL stage files explicitly and run the same temporary-marker and credential scan as the build.

#### Scenario: Marker found
- **WHEN** the staged diff contains a temporary marker
- **THEN** the commit is aborted
