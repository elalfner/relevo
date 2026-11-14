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

### Requirement: The urgent label is a request, not a state
The lifecycle SHALL have an `urgent` label (default name `relevo:urgent`) that asks for an issue to be started before the others and without waiting for the assignee's review capacity. It SHALL be added next to the current state and SHALL NOT replace it, it SHALL be renamable in `labels` like the others, and it SHALL NOT change the owner or the next step of the issue. It SHALL NOT close the issue to editing: an issue that is `needs-spec` and `urgent` can still be corrected by its spec writer.

#### Scenario: Label applied to a queued issue
- **WHEN** a person applies `relevo:urgent` to a `queued` issue
- **THEN** the issue has both labels, and `queued` is replaced by `building` only when the issue starts

#### Scenario: Label stays through the lifecycle
- **WHEN** an urgent issue is built
- **THEN** it is `built` with `relevo:urgent` still on it, and the label is removed with the other Relevo labels when the issue is closed

#### Scenario: Issue sent back to the spec writer
- **WHEN** an urgent issue is labelled `needs-spec`
- **THEN** it keeps `relevo:urgent`, can be edited, and the next step is the one of `needs-spec`

#### Scenario: Renamed label
- **WHEN** `labels.urgent` is set in `relevo.yml`
- **THEN** every behaviour of the label applies to the configured name

### Requirement: Dependencies are not skipped by urgent
A `blocked` issue SHALL stay `blocked` while a `Depends-on` issue is not merged, whether or not it is `urgent`, and the notice that makes it `blocked` SHALL say so when the issue carries `urgent`.

#### Scenario: Urgent and blocked
- **WHEN** an urgent issue becomes `blocked`
- **THEN** the notice names the issues it waits for and says that `urgent` does not skip dependencies

#### Scenario: Dependency merges
- **WHEN** the last dependency of a `blocked` urgent issue is merged
- **THEN** the issue is evaluated before the non-urgent ones

### Requirement: A qa-failed issue with no branch is rebuilt, not fixed
The next-step table SHALL give `qa-failed` a variant for an issue whose build left no branch on the remote. It SHALL have no command, SHALL be owned by the assignee, and its hint SHALL say that nothing was pushed, that the cause named in the comment has to be resolved first, and that the assignee then removes `relevo:qa-failed` and labels the issue `relevo:ready` again. It SHALL exist in every supported language.

#### Scenario: Rebuild variant
- **WHEN** the next step is asked for `qa-failed` with the reason `rebuild`
- **THEN** it has no command, the owner is the assignee, and the hint says to remove `relevo:qa-failed` and label the issue `relevo:ready` again

#### Scenario: Spanish repository
- **WHEN** `language` is `es` and the reason is `rebuild`
- **THEN** the hint is written in Spanish and the label names stay unchanged

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

### Requirement: Missing installed dependencies end in `qa-failed` before the agent
A build that stops before the agent because the dependencies of the platform are not installed SHALL leave the issue `qa-failed`, as a build that stops for a missing tool does, and SHALL NOT use `needs-spec`, because the cause is the configuration of the runner and not the issue.

#### Scenario: The install step is missing
- **WHEN** the paths that the profile requires do not exist after the install step
- **THEN** the issue is `qa-failed` and the comment names the path and the step to enable

### Requirement: The hand-off can carry advisory notes
When a build passes with advisory notes, the hand-off message SHALL say how many there are and name the lens that produced each of the first few, and SHALL carry all of them in a hidden marker. It SHALL NOT notify anyone beyond the person who must act and SHALL add no lifecycle state.

#### Scenario: A passed build with notes
- **WHEN** a build passes and the `interface` lens left two notes
- **THEN** the message says that there are two notes and names the lens, and the marker holds both

#### Scenario: A passed build without notes
- **WHEN** a build passes with no advisory content
- **THEN** the message is as it was and carries no marker

#### Scenario: Many notes
- **WHEN** there are more notes than the message shows
- **THEN** it says how many more there are and the marker still holds all of them

### Requirement: A contradiction sends the issue back with the reason `conflict`
When the check before the build finds that the issue contradicts the project rules or itself, the issue SHALL go back to `needs-spec` with the reason `conflict`, assigned to the spec writer, with a comment that quotes both lines of each pair. Its next step SHALL be to settle which one wins (change the issue, or record an override decision) and label it ready again.

#### Scenario: The comment of the conflict
- **WHEN** the build preflight finds an `Out of scope` line that a rule contradicts
- **THEN** the issue is `needs-spec`, the comment quotes the rule line with its file and line and the `Out of scope` line, and the next step says a person settles which wins

#### Scenario: Next step
- **WHEN** `next-step.mjs --state needs-spec --reason conflict` runs
- **THEN** it prints the command `/relevo:issue {n}` for the spec writer and a hint that names the override decision

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

### Requirement: A queued issue says its position and what it waits for
The comment posted when an issue becomes `queued` for a free agent SHALL state how many runs are active or about to start and which issues they are, how many issues are ahead of it, and the typical duration of the recent builds with how many builds it is taken from. The line SHALL NOT say that an issue is running when it is only about to start. The figures SHALL be read from the repository (the issues and the recent runs of the go workflow) and SHALL NOT be estimated. A figure that cannot be read SHALL be written as `unknown`. The comment for the capacity of the assignee SHALL list the built issues that are waiting for review. Nobody is mentioned, and a later evaluation that leaves the issue queued posts nothing.

#### Scenario: Slots full, issues ahead
- **WHEN** an issue is queued because 2 of 2 agents are running and 1 issue is queued before it
- **THEN** the comment says 2 runs active or starting and their issue numbers, 1 ahead, and the typical build duration with its sample size

#### Scenario: An issue about to start holds the slot
- **WHEN** an issue is started by the same evaluation that queues another one for lack of a slot
- **THEN** the comment of the queued issue lists the started issue under "Running or starting now", not "Running now"

#### Scenario: No recent runs
- **WHEN** the repository has fewer than three completed builds, or their durations cannot be read
- **THEN** the typical duration is `unknown` and no number is written in its place

#### Scenario: Capacity of the assignee
- **WHEN** an issue is queued because its assignee has too many built issues waiting
- **THEN** the comment lists those issues by number, and says the limit

#### Scenario: Two languages
- **WHEN** `language` is `es`
- **THEN** the same comment is written in Spanish with `desconocido` where `unknown` would be written

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

### Requirement: A queued issue can wait for a file shared with another issue
`queued` SHALL have a third reason, a file that another issue names, besides the capacity of the assignee and a free agent slot. Entering it SHALL post one comment that names the file and the issue it waits for and mentions nobody. Later evaluations that leave it queued for that reason SHALL post nothing, and a change of the file or of the issue SHALL post one new comment.

#### Scenario: Entering the wait
- **WHEN** an eligible issue becomes `queued` because it names `router.ts` and issue 12 is active
- **THEN** one comment says so, with the file and `#12`, and nobody is mentioned

#### Scenario: Staying in the wait
- **WHEN** the next evaluation leaves it queued for the same file and the same issue
- **THEN** no comment is posted

#### Scenario: The reason changes
- **WHEN** issue 12 is merged and the issue then waits for the same file because issue 18 is active
- **THEN** one new comment names issue 18

#### Scenario: Language of the comment
- **WHEN** `language` in `relevo.yml` is Spanish
- **THEN** the comment is in Spanish, like every other message
