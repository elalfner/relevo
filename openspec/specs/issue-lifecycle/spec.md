# issue-lifecycle Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: Lifecycle states with a single owner
An issue SHALL move through these states, each represented by a label and each having exactly one owner: `ready` (spec writer), `queued` (agent), `building` (agent), `built` (assignee), `in-review` (assignee), `pr-open` (peer). The final state is the issue being closed as completed; there is no `merged` label.

#### Scenario: Normal path
- **WHEN** an issue is built successfully, reviewed on a device, opened as a pull request, approved and merged
- **THEN** it passes through `ready`, `building`, `built`, `in-review`, `pr-open` and ends closed as completed with no lifecycle label, having exactly one lifecycle label at any time before that

#### Scenario: One state at a time
- **WHEN** a command changes an issue's state
- **THEN** it removes the previous lifecycle label and adds the new one in the same operation

### Requirement: Side exits
The lifecycle SHALL provide these exits, each with an owner and a message that says why: `needs-spec` (spec writer), `blocked` (nobody, until the dependency merges), `qa-failed` (assignee), `changes-requested` (author), `needs-reviewer` (spec writer).

#### Scenario: Exit leaves a reason
- **WHEN** an issue enters a side exit
- **THEN** a comment states the reason, the owner and the next command or action expected

### Requirement: Side exits replace the state, except needs-reviewer
`needs-spec`, `blocked`, `qa-failed` and `changes-requested` SHALL replace the current state label, so an issue never shows two states. `needs-reviewer` SHALL be added next to the current state and SHALL NOT replace it.

#### Scenario: QA fails while building
- **WHEN** an issue labelled `building` fails QA after its retries
- **THEN** `building` is removed and `qa-failed` is added in the same operation

#### Scenario: Review is overdue
- **WHEN** a pull request labelled `pr-open` exceeds the escalation time
- **THEN** `needs-reviewer` is added and `pr-open` stays

### Requirement: Review events update the label
A workflow reacting to pull request review events SHALL keep the lifecycle label in sync: a review that requests changes sets `changes-requested` and mentions the author; a new push or fix that addresses them returns the issue to `pr-open`.

#### Scenario: Changes requested
- **WHEN** a reviewer submits a review requesting changes on an open pull request
- **THEN** the issue is labelled `changes-requested` and the author is mentioned with the reviewer's summary

#### Scenario: Approval
- **WHEN** a reviewer approves
- **THEN** the issue stays `pr-open` and the person who will run `ship` is mentioned, with both ways to ship: applying the `ship` label when the ship workflow is installed, or running `/relevo:ship <n>`

### Requirement: Reviewer selection
When a pull request is opened, the reviewer SHALL be chosen from `team.members`, excluding the author and the spec writer, as the member with the fewest open review requests, ties broken in rotation. In `roles` mode only members of `team.approvers` are eligible. When nobody is eligible the issue SHALL be labelled `needs-reviewer`.

#### Scenario: Two developers
- **WHEN** Persona B opens a pull request in a team of Persona A (the spec writer) and Persona B and Persona C (developers)
- **THEN** Persona C is requested as reviewer

#### Scenario: Several eligible reviewers
- **WHEN** Persona D joins as a third developer, and when Persona B opens a pull request Persona C has more open reviews than Persona D
- **THEN** Persona D is requested as reviewer

#### Scenario: Nobody eligible
- **WHEN** no member is eligible
- **THEN** the issue is labelled `needs-reviewer` and the spec writer is mentioned

### Requirement: Dependencies in the issue
An issue SHALL declare dependencies with a `Depends-on: #N` line in its body.

#### Scenario: Dependency not merged
- **WHEN** an issue is eligible to start and a `Depends-on` issue is not merged
- **THEN** the issue is labelled `blocked` and is not started

#### Scenario: Dependency merges
- **WHEN** the last dependency of a `blocked` issue is merged
- **THEN** the `blocked` label is removed and the issue re-enters the queue at its original position

### Requirement: Notifications by hand-off only
A comment that notifies a person SHALL be posted only at a hand-off, and SHALL mention only the person who must act. Waiting states (`queued`, `blocked`) SHALL NOT notify.

#### Scenario: Waiting state
- **WHEN** an issue becomes `queued` or `blocked`
- **THEN** its label changes and no person is mentioned

#### Scenario: Blocked states its reason without mentioning anyone
- **WHEN** an issue becomes `blocked`
- **THEN** one comment names the issues it is waiting for and nobody is mentioned; later evaluations that leave it blocked post nothing

#### Scenario: Queued states its reason without mentioning anyone
- **WHEN** an issue becomes `queued`
- **THEN** one comment says whether it waits for the assignee's capacity or for a free agent slot and nobody is mentioned; later evaluations that leave it queued post nothing

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

### Requirement: Review reminders and escalation
When a pull request is not reviewed within `limits.review_sla_hours`, a reminder SHALL be sent to the peer. After a second equal period it SHALL mention the spec writer and add `needs-reviewer`.

#### Scenario: Peer does not review
- **WHEN** a pull request has waited `review_sla_hours` without a review
- **THEN** the peer receives one reminder
- **AND WHEN** another `review_sla_hours` pass
- **THEN** the spec writer is mentioned and `needs-reviewer` is added

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

### Requirement: The ship label is a request, not a state
The lifecycle SHALL have a `ship` label (default name `relevo:ship`) that asks for an unattended ship. It SHALL be added next to `pr-open` and SHALL NOT replace it, it SHALL be renamable in `labels` like the others, and every ship run SHALL remove it whether it merges or stops.

#### Scenario: Label applied
- **WHEN** a person applies `relevo:ship` to a `pr-open` issue
- **THEN** the issue has both labels until the run ends

#### Scenario: Run ends
- **WHEN** the run merges or stops
- **THEN** `relevo:ship` is no longer on the issue
