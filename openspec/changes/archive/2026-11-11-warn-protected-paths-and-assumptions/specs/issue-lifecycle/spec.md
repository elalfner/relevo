## MODIFIED Requirements

### Requirement: `needs-spec` has the reasons `inputs` and `policy`
A build that cannot succeed because of what the issue depends on SHALL send the issue to `needs-spec` with the reason `inputs` (an input cannot be read or is not available) or `policy` (a task needs a protected path, or a dependency the issue did not allow). Each reason SHALL have an entry in the table of next steps and a message, in both languages, that names what is missing and the command to run. The next step of `policy` SHALL be true for both causes: a person makes the edit that an unattended run cannot make, or the issue changes so that no task needs it, and only a dependency manifest can be allowed, with an `Allow-paths:` line.

#### Scenario: The next step for `inputs`
- **WHEN** the next step is asked for `needs-spec` with the reason `inputs`
- **THEN** it says that an input of the issue is not available, names the writer as the owner and gives the command that completes the issue

#### Scenario: The next step for `policy`
- **WHEN** the next step is asked for `needs-spec` with the reason `policy`
- **THEN** it says which task needs something an unattended run may not do, names the writer as the owner and gives the command that rewrites the issue

#### Scenario: A protected path that is not a dependency manifest
- **WHEN** the `policy` comment is for a task that changes the project rules file
- **THEN** the next step says that a person makes that edit or the issue changes, and does not offer `Allow-paths:` for it

#### Scenario: Both languages
- **WHEN** the repository language is Spanish and a message for either reason is rendered
- **THEN** it is in Spanish and has the same content as the English one

## ADDED Requirements

### Requirement: A protected path that the commit guard refused is reported as a policy
When a run ends because the safe commit refused a protected path (`protected path in the diff`), the `qa-failed` comment SHALL say that an unattended run cannot edit that path, that QA did not reject the work, and that nothing was pushed, and SHALL NOT say that QA rejected it after the retries. Its next step SHALL be the command that rewrites the issue, with a hint that a person makes the edit or the issue changes. A run that QA rejected keeps its wording.

#### Scenario: The commit guard refuses the rules file
- **WHEN** a `qa_failed` message has the reason `protected path in the diff`
- **THEN** it says that an unattended run cannot edit that path and that QA did not reject it, names the file, and the next step is `/relevo:issue <n>`

#### Scenario: QA rejected the work
- **WHEN** a `qa_failed` message has the reason `QA rejected after the retries`
- **THEN** it says that QA still rejected it after the retries, as before

#### Scenario: Both languages
- **WHEN** the language is Spanish
- **THEN** the same content is written in Spanish

### Requirement: The hand-off lists the assumptions and the shared code
The hand-off message SHALL show, when there are any, a line `Assumed, not confirmed` near the top, with the assumptions about names outside the repository that nothing in the repository settled, and a line `Shared code touched` with the files of the build that more than one file uses or that live in a shared folder. Both lines SHALL be left out when empty. Neither SHALL notify anyone beyond the person who must act or add a lifecycle state.

#### Scenario: Assumptions in the hand-off
- **WHEN** the build passes with an unsettled assumption about a permission name
- **THEN** the message has the line `Assumed, not confirmed` before the branch line, naming the permission

#### Scenario: Shared code in the hand-off
- **WHEN** the build changed a component that two screens import
- **THEN** the message has the line `Shared code touched` naming that file

#### Scenario: Neither
- **WHEN** nothing is assumed and no shared file changed
- **THEN** the message is as it was
