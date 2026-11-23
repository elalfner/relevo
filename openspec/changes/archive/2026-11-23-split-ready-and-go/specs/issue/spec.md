# Spec Delta

## MODIFIED Requirements

### Requirement: Issue never starts a build
`issue` SHALL NOT apply the `ready` or the `go` label on its own. Applying `ready` is the writer's explicit decision that the specification is finished, and it starts nothing; applying `go` asks the cloud to build. `issue` SHALL apply either only after the separate question about them is answered with a clear choice.

#### Scenario: Issues created
- **WHEN** the issues have been created
- **THEN** `issue` lists their links, asks the separate question about `ready` and `go`, and applies no lifecycle label before an answer

### Requirement: Issue offers ready as a separate question
After creating or updating issues, `issue` SHALL ask one separate question with three answers: apply nothing, apply `ready` only, or apply `ready` and `go`. It SHALL name each issue, say that `ready` approves the text and starts nothing, and that `go` starts a build in the cloud. It SHALL apply the labels only on a clear choice and only when the person has write access, and for an updated issue labelled `needs-spec` the same choice SHALL replace `needs-spec` with `ready`. It SHALL offer `go` only where the cloud can build. It SHALL NOT apply any label otherwise.

#### Scenario: Offer after creating
- **WHEN** issues 42 and 43 have been created
- **THEN** `issue` asks whether to apply nothing, `ready`, or `ready` and `go` to #42 and #43, and applies nothing until the person answers

#### Scenario: Declined
- **WHEN** the person answers that nothing should be applied
- **THEN** no label is applied and `issue` reminds that an issue is built only after it is approved with `ready`

#### Scenario: No write access
- **WHEN** the person cannot write labels
- **THEN** `issue` says so and leaves the labels to someone who can

#### Scenario: Approval only
- **WHEN** the person answers `ready` only
- **THEN** `ready` is applied, no build starts, and `issue` says how to build each issue: the `go` label or `/relevo:go <n>`

#### Scenario: Approval and request
- **WHEN** the person answers `ready` and `go`
- **THEN** both labels are applied to each issue and the cloud evaluates them

#### Scenario: The cloud cannot build
- **WHEN** the `go` workflow is not installed
- **THEN** the question offers only nothing or `ready`, and says that the issue is built with `/relevo:go <n>`

### Requirement: Only an issue Relevo has not committed to a build may be edited
Update mode SHALL read the issue and SHALL proceed only when the issue is open and carries no lifecycle label, or carries only `needs-spec`. For an issue closed, or labelled `queued`, `blocked`, `building`, `built`, `in-review`, `pr-open`, `build-failed`, `changes-requested` or `needs-reviewer`, or `ready` with a `go` label, it SHALL change nothing, name the label found and explain that what is written is what `go` builds. For an issue labelled `ready` with no `go` label it SHALL ask whether to withdraw the approval in order to edit: on a clear yes it removes `ready`, goes on with the update and offers the approval again at the end; otherwise it changes nothing. It SHALL NOT apply, remove or replace any other label, except the swap of `needs-spec` for `ready` after the separate question is answered.

#### Scenario: Issue ready
- **WHEN** the person runs `/relevo:issue 42` and issue 42 is labelled `relevo:ready` with no `go` label
- **THEN** `issue` says the text is approved, asks whether to withdraw the approval to edit it, and edits nothing before a clear yes

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
- **WHEN** issue 42 is labelled only `needs-spec`, the update is applied and the person answers `ready` to the separate question
- **THEN** `needs-spec` is removed, `ready` is applied and no build starts

#### Scenario: Approval withdrawn to edit
- **WHEN** issue 42 is `ready` with no `go` label and the person answers yes to withdrawing the approval
- **THEN** `ready` is removed, the update flow goes on, and the question about `ready` and `go` is asked again at the end

#### Scenario: Build requested and not answered
- **WHEN** issue 42 is `ready` with a `go` label
- **THEN** `issue` refuses, because a build was requested for that text, and edits nothing
