## ADDED Requirements

### Requirement: A stop that is not a QA rejection is not reported as one
The `qa-failed` comment SHALL say that QA rejected the work only for a QA rejection (the reasons `QA rejected after the retries` and `QA rejected: nothing the developer agent can fix`) and for a comment with no reason. For any other reason, including one the catalog does not know, the title and the line that says what happened SHALL say that the run stopped for that reason and that QA did not reject the work, and SHALL NOT say that QA rejected it or that QA did so after the retries. The line that says what happened for the reasons that have wording of their own (a run limit, a protected path in the diff) and the next step of the comment SHALL be as before; their title follows the same rule as any other stop that is not a QA rejection.

#### Scenario: The branch already exists
- **WHEN** a `qa_failed` message has the reason `branch already exists`
- **THEN** its title does not say `failed QA`, it says that the run stopped for that reason and that QA did not reject the work, and the next step is the one of the state of the branch

#### Scenario: `fix` still finds the comment
- **WHEN** a `qa-failed` comment was written for a stop that is not a QA rejection, or for a QA rejection, in either language
- **THEN** the reader that `fix` uses finds it by its title and reads its finding, and it still finds the comments written with the earlier titles

#### Scenario: A reason the catalog does not know
- **WHEN** a `qa_failed` message has a reason that no text of the catalog names
- **THEN** it says that the run stopped for that reason and does not say that QA rejected anything

#### Scenario: QA rejected the work
- **WHEN** a `qa_failed` message has the reason `QA rejected after the retries` or `QA rejected: nothing the developer agent can fix`
- **THEN** the comment is as before

#### Scenario: No reason
- **WHEN** a `qa_failed` message has no reason
- **THEN** the comment is as before

#### Scenario: Both languages
- **WHEN** the language is Spanish
- **THEN** the same comments are written in Spanish, with the reason as the skill names it
