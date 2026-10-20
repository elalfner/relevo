## ADDED Requirements

### Requirement: The issue format carries what the agreement settled
The format SHALL have these optional sections, with headings in English and contents in the language of the repository: `Outcome`, `Decisions` (each `### D<n>. <title>` with `Decided`, `Why` and `Discarded`), `Constraints` (each `C<n>`), `Code pointers`, `Verification`, `Assumptions` and `Open questions`, and an optional `Related:` line. An issue that has only the sections of the earlier format SHALL still pass the check.

#### Scenario: Earlier issue
- **WHEN** an issue has scenarios, edge cases and out of scope only
- **THEN** it passes the check as it did before

#### Scenario: Decision with its reason
- **WHEN** the agreement settled that a list is sorted by date and why
- **THEN** the draft has `### D1.` with what was decided, why and what was discarded

### Requirement: An issue with unanswered questions is not complete
The check SHALL fail a draft whose `Open questions` section has content or whose text contains `NEEDS CLARIFICATION`, and SHALL fail one whose decision or constraint ids are repeated or malformed. It SHALL warn, without failing, when the body is over 8,000 characters.

#### Scenario: Open question
- **WHEN** a draft has a question under `Open questions`
- **THEN** the check fails and names the section

#### Scenario: Repeated id
- **WHEN** two decisions are both `D1`
- **THEN** the check fails and names the id

#### Scenario: Long body
- **WHEN** the body has 9,000 characters
- **THEN** the check passes with a warning about the length

### Requirement: Nothing from the agreement is lost on the way to the issue
Before asking for approval, `issue` SHALL show which id of the agreement went to which section of which issue and which ids went nowhere, and a script SHALL verify it. An id SHALL be left out only when the person marks it as discarded.

#### Scenario: An id with no destination
- **WHEN** the agreement has `D3` and no draft mentions it
- **THEN** the table lists `D3` as without destination and `issue` asks whether to place it or discard it

#### Scenario: Discarded on purpose
- **WHEN** the person marks `D3` as discarded
- **THEN** the check passes and `D3` is listed as discarded

### Requirement: Issue offers ready as a separate question
After creating or updating issues, `issue` SHALL ask one separate yes/no question: whether to apply `ready` to them, naming each issue and that each starts a build. It SHALL apply the label only on a clear yes and only when the person has write access, and for an updated issue labelled `needs-spec` the same yes SHALL replace `needs-spec` with `ready`. It SHALL NOT apply any label otherwise.

#### Scenario: Offer after creating
- **WHEN** issues 42 and 43 have been created
- **THEN** `issue` asks "apply ready to #42 and #43? each starts a build" and applies nothing until the person answers yes

#### Scenario: Declined
- **WHEN** the person answers no
- **THEN** no label is applied and `issue` reminds that `go` starts when `ready` is applied

#### Scenario: No write access
- **WHEN** the person cannot write labels
- **THEN** `issue` says so and leaves the label to someone who can

### Requirement: Similar issues are looked for first
Before showing a draft, `issue` SHALL search the open issues for similar ones and SHALL show those it finds, asking whether the draft is still needed.

#### Scenario: A similar issue exists
- **WHEN** an open issue has nearly the same title
- **THEN** `issue` shows it before the draft and asks whether to go on, update that one or stop

## MODIFIED Requirements

### Requirement: Issue never starts a build
`issue` SHALL NOT apply the `ready` label on its own. Applying it is the writer's explicit decision that the specification is finished, and it is what starts `go`; `issue` SHALL apply it only after the separate question "apply `ready`?" is answered with a clear yes.

#### Scenario: Issues created
- **WHEN** the issues have been created
- **THEN** `issue` lists their links, asks the separate question about `ready` and applies no lifecycle label before a yes

### Requirement: Only an issue Relevo has not committed to a build may be edited
Update mode SHALL read the issue and SHALL proceed only when the issue is open and carries no lifecycle label, or carries only `needs-spec`. For an issue closed, or labelled `ready`, `queued`, `blocked`, `building`, `built`, `in-review`, `pr-open`, `qa-failed`, `changes-requested` or `needs-reviewer`, it SHALL change nothing, name the label found, explain that what is written is what `go` builds, and say how to proceed: remove `ready` by hand, edit, and apply `ready` again. It SHALL NOT apply, remove or replace any label, except the swap of `needs-spec` for `ready` after the separate question about `ready` is answered with a clear yes.

#### Scenario: Issue ready
- **WHEN** the person runs `/relevo:issue 42` and issue 42 is labelled `relevo:ready`
- **THEN** `issue` refuses, says the text is what `go` builds, tells the person to remove `ready` by hand, edit and apply it again, and edits nothing

#### Scenario: Build in progress
- **WHEN** issue 42 is labelled `relevo:building`
- **THEN** `issue` refuses, says the build must finish or fail first, and edits nothing

#### Scenario: Waiting to start
- **WHEN** issue 42 is labelled `relevo:blocked` or `relevo:queued`
- **THEN** `issue` refuses because `go` starts it without anyone rereading the text

#### Scenario: Already built
- **WHEN** issue 42 is labelled `relevo:built`, `in-review` or `pr-open`
- **THEN** `issue` refuses and edits nothing

#### Scenario: Returned to the spec writer
- **WHEN** issue 42 is labelled `relevo:needs-spec`
- **THEN** `issue` proceeds with the update flow and leaves the label as it is until the person answers the separate question about `ready`

#### Scenario: Not started
- **WHEN** issue 42 is open and has no lifecycle label
- **THEN** `issue` proceeds with the update flow

#### Scenario: Closed issue
- **WHEN** issue 42 is closed
- **THEN** `issue` refuses and edits nothing

#### Scenario: Issue does not exist
- **WHEN** `gh issue view` reports that issue 99 does not exist
- **THEN** `issue` says so and edits nothing

#### Scenario: Needs-spec swapped for ready
- **WHEN** issue 42 is labelled only `needs-spec`, the update is applied and the person answers yes to the question about `ready`
- **THEN** `needs-spec` is removed and `ready` is applied
