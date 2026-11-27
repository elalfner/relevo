# Spec Delta

## ADDED Requirements

### Requirement: The label descriptions carry the next step
The description of each state label, each exit label and `needs-reviewer` SHALL first say what the label means and then name the next command that the next-step table gives for it or, when the table gives no command, say that nothing is to be done, or who has to do what. It SHALL name no command that the table does not give for that state. It SHALL be in English and have at most 100 characters. The descriptions of `ship`, `urgent`, `go` and `local` SHALL stay as they are.

#### Scenario: A state with a command
- **WHEN** the `built` label is created
- **THEN** its description says that it is built and QA passed, and then names `/relevo:review <n>`

#### Scenario: A state where nobody acts
- **WHEN** the `queued`, `building` or `blocked` label is created
- **THEN** its description says what it is waiting for or doing, and then that nothing is to be done

#### Scenario: Approval
- **WHEN** the `ready` label is created
- **THEN** its description names `/relevo:go <n>` and says that approving starts nothing

#### Scenario: The spec goes back
- **WHEN** the `needs-spec` label is created
- **THEN** its description says that the spec needs work, names `/relevo:issue <n>` and says that the comment says the rest

#### Scenario: A failed build
- **WHEN** the `build-failed` label is created
- **THEN** its description is `Build failed. Next: /relevo:go <n> --resume or /relevo:fix <n>; the comment says which`

#### Scenario: No reviewer
- **WHEN** the `needs-reviewer` label is created
- **THEN** its description says that the spec writer assigns one or asks someone, and does not say that nothing is to be done

#### Scenario: A command the table does not give
- **WHEN** a description names a command that the table does not give for that state
- **THEN** a test fails and names the label

## MODIFIED Requirements

### Requirement: A failed build has one label, whatever the reason
A build that ends without a hand-off SHALL leave the issue with the `build-failed` label, whatever the reason: QA rejected the work, a limit stopped the run, or the build could not start or finish. There SHALL be one such label, owned by the assignee, and its description SHALL name the common recoveries and say that the comment says which applies. The name of the label SHALL NOT name one of the reasons.

#### Scenario: QA rejected the work
- **WHEN** QA still rejects the work after the retries
- **THEN** the issue is labelled `build-failed` and the comment gives the reason "QA rejected after the retries"

#### Scenario: A limit stopped the run
- **WHEN** a run stops at its turn limit with work in progress
- **THEN** the issue is labelled `build-failed`, the same label as for a QA rejection, and the comment says that the run stopped at a limit

#### Scenario: The description of the label
- **WHEN** the label is created in a repository
- **THEN** its description names `/relevo:go <n> --resume` and `/relevo:fix <n>`, says that the comment says which, and does not say that QA rejected the work
