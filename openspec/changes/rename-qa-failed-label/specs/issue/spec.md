# Spec Delta

## MODIFIED Requirements

### Requirement: Only an issue Relevo has not committed to a build may be edited
Update mode SHALL read the issue and SHALL proceed only when the issue is open and carries no lifecycle label, or carries only `needs-spec`. For an issue closed, or labelled `ready`, `queued`, `blocked`, `building`, `built`, `in-review`, `pr-open`, `build-failed`, `changes-requested` or `needs-reviewer`, it SHALL change nothing, name the label found, explain that what is written is what `go` builds, and say how to proceed: remove `ready` by hand, edit, and apply `ready` again. It SHALL NOT apply, remove or replace any label, except the swap of `needs-spec` for `ready` after the separate question about `ready` is answered with a clear yes.

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
