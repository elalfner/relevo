# Spec Delta

## MODIFIED Requirements

### Requirement: A local build skips the gates that ration automatic work
A local build SHALL pass the gates that protect the build: a valid approval, an assignee, a complete text and merged dependencies. A milestone SHALL NOT be one of them. It SHALL NOT wait for the limit of concurrent agents or for the review capacity of the assignee. A file shared with an issue that is not merged SHALL NOT hold it: the build goes on and its hand-off lists the shared files.

#### Scenario: Limit of agents reached
- **WHEN** `limits.concurrent_agents` cloud builds are running and a person starts a local build
- **THEN** the local build starts

#### Scenario: Shared file
- **WHEN** issue 42 names a file that issue 40, built and not merged, also names, and a person starts a local build of 42
- **THEN** the build starts at once, and its hand-off message lists the file and issue 40

#### Scenario: Incomplete text
- **WHEN** the text of the issue lacks a required section and a person starts a local build
- **THEN** nothing is built and the issue goes to `needs-spec`, as it would in the cloud

#### Scenario: No milestone
- **WHEN** an approved issue with an assignee has no milestone and a person starts a local build
- **THEN** the build starts, as it would in the cloud

### Requirement: A local build never joins the cloud queue
A local build that cannot start because it would have to wait SHALL report why and SHALL leave the labels of the issue as they were: it SHALL NOT move an issue to `queued` or `blocked`. A decision that sends the issue back to its writer (an incomplete text, an approval that is not valid, a missing assignee) SHALL be applied as in the cloud.

#### Scenario: Dependency not merged
- **WHEN** issue 42 is `ready`, depends on issue 12, which is not merged, and a person runs `/relevo:go 42`
- **THEN** nothing is built, the report names issue 12, and issue 42 stays `ready` with no comment that says it is blocked

#### Scenario: Nothing for the queue to pick up
- **WHEN** that dependency merges later
- **THEN** the queue does not start issue 42, because nobody requested its build
