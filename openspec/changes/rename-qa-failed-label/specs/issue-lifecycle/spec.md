# Spec Delta

## ADDED Requirements

### Requirement: A failed build has one label, whatever the reason
A build that ends without a hand-off SHALL leave the issue with the `build-failed` label, whatever the reason: QA rejected the work, a limit stopped the run, or the build could not start or finish. There SHALL be one such label, owned by the assignee, and its description SHALL say that the build did not end in a hand-off and that the comment says why and what to do. The name of the label SHALL NOT name one of the reasons.

#### Scenario: QA rejected the work
- **WHEN** QA still rejects the work after the retries
- **THEN** the issue is labelled `build-failed` and the comment gives the reason "QA rejected after the retries"

#### Scenario: A limit stopped the run
- **WHEN** a run stops at its turn limit with work in progress
- **THEN** the issue is labelled `build-failed`, the same label as for a QA rejection, and the comment says that the run stopped at a limit

#### Scenario: The description of the label
- **WHEN** the label is created in a repository
- **THEN** its description says that the build did not end in a hand-off, and does not say that QA rejected it

## RENAMED Requirements

- FROM: `### Requirement: A qa-failed issue with no branch is rebuilt, not fixed`
- TO: `### Requirement: A build-failed issue with no branch is rebuilt, not fixed`

- FROM: `### Requirement: Missing installed dependencies end in `qa-failed` before the agent`
- TO: `### Requirement: Missing installed dependencies end in `build-failed` before the agent`

## MODIFIED Requirements

### Requirement: Side exits
The lifecycle SHALL provide these exits, each with an owner and a message that says why: `needs-spec` (spec writer), `blocked` (nobody, until the dependency merges), `build-failed` (assignee), `changes-requested` (author), `needs-reviewer` (spec writer).

#### Scenario: Exit leaves a reason
- **WHEN** an issue enters a side exit
- **THEN** a comment states the reason, the owner and the next command or action expected

### Requirement: Side exits replace the state, except needs-reviewer
`needs-spec`, `blocked`, `build-failed` and `changes-requested` SHALL replace the current state label, so an issue never shows two states. `needs-reviewer` SHALL be added next to the current state and SHALL NOT replace it.

#### Scenario: QA fails while building
- **WHEN** an issue labelled `building` fails QA after its retries
- **THEN** `building` is removed and `build-failed` is added in the same operation

#### Scenario: Review is overdue
- **WHEN** a pull request labelled `pr-open` exceeds the escalation time
- **THEN** `needs-reviewer` is added and `pr-open` stays

### Requirement: A build-failed issue with no branch is rebuilt, not fixed
The next-step table SHALL give `build-failed` a variant for an issue whose build left no branch on the remote. It SHALL have no command, SHALL be owned by the assignee, and its hint SHALL say that nothing was pushed, that the cause named in the comment has to be resolved first, and that the assignee then removes `relevo:build-failed` and labels the issue `relevo:ready` again. It SHALL exist in every supported language.

#### Scenario: Rebuild variant
- **WHEN** the next step is asked for `build-failed` with the reason `rebuild`
- **THEN** it has no command, the owner is the assignee, and the hint says to remove `relevo:build-failed` and label the issue `relevo:ready` again

#### Scenario: Spanish repository
- **WHEN** `language` is `es` and the reason is `rebuild`
- **THEN** the hint is written in Spanish and the label names stay unchanged

### Requirement: Missing installed dependencies end in `build-failed` before the agent
A build that stops before the agent because the dependencies of the platform are not installed SHALL leave the issue `build-failed`, as a build that stops for a missing tool does, and SHALL NOT use `needs-spec`, because the cause is the configuration of the runner and not the issue.

#### Scenario: The install step is missing
- **WHEN** the paths that the profile requires do not exist after the install step
- **THEN** the issue is `build-failed` and the comment names the path and the step to enable

### Requirement: A protected path that the commit guard refused is reported as a policy
When a run ends because the safe commit refused a protected path (`protected path in the diff`), the `build-failed` comment SHALL say that an unattended run cannot edit that path, that QA did not reject the work, and that nothing was pushed, and SHALL NOT say that QA rejected it after the retries. Its next step SHALL be the command that rewrites the issue, with a hint that a person makes the edit or the issue changes. A run that QA rejected keeps its wording.

#### Scenario: The commit guard refuses the rules file
- **WHEN** a `qa_failed` message has the reason `protected path in the diff`
- **THEN** it says that an unattended run cannot edit that path and that QA did not reject it, names the file, and the next step is `/relevo:issue <n>`

#### Scenario: QA rejected the work
- **WHEN** a `qa_failed` message has the reason `QA rejected after the retries`
- **THEN** it says that QA still rejected it after the retries, as before

#### Scenario: Both languages
- **WHEN** the language is Spanish
- **THEN** the same content is written in Spanish

### Requirement: A stop that is not a QA rejection is not reported as one
The `build-failed` comment SHALL say that QA rejected the work only for a QA rejection (the reasons `QA rejected after the retries` and `QA rejected: nothing the developer agent can fix`) and for a comment with no reason. For any other reason, including one the catalog does not know, the title and the line that says what happened SHALL say that the run stopped for that reason and that QA did not reject the work, and SHALL NOT say that QA rejected it or that QA did so after the retries. The line that says what happened for the reasons that have wording of their own (a run limit, a protected path in the diff) and the next step of the comment SHALL be as before; their title follows the same rule as any other stop that is not a QA rejection.

#### Scenario: The branch already exists
- **WHEN** a `qa_failed` message has the reason `branch already exists`
- **THEN** its title does not say `failed QA`, it says that the run stopped for that reason and that QA did not reject the work, and the next step is the one of the state of the branch

#### Scenario: `fix` still finds the comment
- **WHEN** a `build-failed` comment was written for a stop that is not a QA rejection, or for a QA rejection, in either language
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
