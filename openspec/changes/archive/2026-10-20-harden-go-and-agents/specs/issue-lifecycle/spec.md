# Spec Delta

## MODIFIED Requirements

### Requirement: Hand-off message content
Each hand-off message SHALL state what happened, what is expected of the recipient, the exact command to run next and who runs it, the riskiest area to check first (when known) and the expected time. It SHALL link to long logs instead of embedding them.

#### Scenario: Successful build
- **WHEN** a build passes QA
- **THEN** the assignee is mentioned with: completed tasks, QA result, the branch, the number of scenarios to test, the riskiest area, the short hash of the issue text it was built from, the command `/relevo:review <n>` and the expected time

#### Scenario: Failed build
- **WHEN** a build fails QA after its retries
- **THEN** the assignee is mentioned with the failing finding (file and line), a note that the branch is pushed, and the command `/relevo:fix <n>`

#### Scenario: Failed because the branch already exists
- **WHEN** a run ends because the feature branch already exists on the remote
- **THEN** the message says that the branch was not touched and gives the recovery for its content: `/relevo:fix <n>` when it holds implementation commits, or delete the remote branch and apply `ready` again when it holds only the specification

#### Scenario: Spec returned with a reason
- **WHEN** an issue goes back to the spec writer
- **THEN** the message says whether something is missing or something is ambiguous, and the next step follows from that reason

## ADDED Requirements

### Requirement: The next step comes from one source
The next step shown by every hand-off and failure message SHALL come from one table that gives, for each lifecycle state (and the reason for `needs-spec`), the command and who runs it, in the language of the repository. Every state of the lifecycle SHALL have an entry.

#### Scenario: Every state has an entry
- **WHEN** the lifecycle gains a state
- **THEN** a test fails until the table has an entry for it

#### Scenario: Missing information
- **WHEN** the next step is asked for `needs-spec` with the reason `missing`
- **THEN** it is `/relevo:issue <n>`, run by the spec writer

#### Scenario: Ambiguity
- **WHEN** the next step is asked for `needs-spec` with the reason `ambiguous`
- **THEN** it asks the spec writer to decide the open question and then run `/relevo:issue <n>`, and says that `/relevo:think` can explore it first

#### Scenario: Spanish repository
- **WHEN** `language` is `es`
- **THEN** the line is written in Spanish and the command stays unchanged
