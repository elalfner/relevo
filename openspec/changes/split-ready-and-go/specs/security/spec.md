# Spec Delta

## ADDED Requirements

### Requirement: The approval covers the text as it was approved
Before an issue is claimed, in the cloud or on a machine, the last edit of its title and of its body SHALL be compared with the moment `ready` was last applied. When either was edited later, by anyone, the issue SHALL NOT be built: `ready` and `go` are removed, the issue is a draft again, and one comment names who had approved it and asks for a new approval. It SHALL NOT become `needs-spec` or `build-failed`.

#### Scenario: Body edited days after the approval
- **WHEN** issue 42 was approved on Monday, its body was edited on Wednesday and `go` is applied on Thursday
- **THEN** nothing is built, the issue has no lifecycle label, and one comment names the approver and asks to approve it again

#### Scenario: Edited by the person who approved
- **WHEN** the person who applied `ready` edits the body afterwards and then starts a local build
- **THEN** nothing is built and the issue loses `ready`, as for an edit by anyone else

#### Scenario: Title changed
- **WHEN** only the title was changed after `ready` was applied
- **THEN** the issue is treated as edited

#### Scenario: Unchanged
- **WHEN** neither the title nor the body was edited after `ready` was applied
- **THEN** the gates go on

### Requirement: Nothing is built when the approval cannot be checked
When the last edit of an issue or the moment of its approval cannot be read, the issue SHALL NOT be claimed or built, its labels SHALL NOT be changed, and the reason SHALL be said. The check SHALL NOT be skipped.

#### Scenario: The edit history cannot be read
- **WHEN** the request for the last edit of the issue fails
- **THEN** nothing is built, the issue keeps its labels, and the report says that the approval could not be checked

## MODIFIED Requirements

### Requirement: The issue that is built is the issue that was approved
When the planner claims an issue it SHALL record a hash of the issue title and body in its decision, and `go` SHALL verify it before writing the specification. If it differs, the run SHALL end in `build-failed` with the reason "issue changed after ready" and push nothing. Line endings and trailing spaces SHALL NOT change the hash. This check covers the time between the claim and the build; an edit made between the approval and the claim is caught before the claim.

#### Scenario: Issue edited after ready
- **WHEN** the author edits the body of an issue after it was claimed and before `go` reads it
- **THEN** the hashes differ, nothing is built or pushed, and the issue is labelled `build-failed` with the reason "issue changed after ready"

#### Scenario: Issue unchanged
- **WHEN** the title and body are the same as when the issue was claimed
- **THEN** `go` continues

#### Scenario: Only whitespace differs
- **WHEN** the body differs from the claimed one only in line endings or trailing spaces
- **THEN** the hashes are equal and `go` continues

#### Scenario: Run started by hand
- **WHEN** someone runs `go` for an issue without a decision from the workflow
- **THEN** the same hash is computed when the issue is claimed and verified before the specification is written

### Requirement: Trust level
When `trust` is `public`, the system SHALL restrict builds to issues that a maintainer approved and whose build a maintainer requested or started, SHALL NOT run on content from forks, and SHALL require stricter review of generated code.

#### Scenario: Public repository
- **WHEN** `trust` is `public` and a non-maintainer applies `ready`
- **THEN** no run starts, whoever requests the build

#### Scenario: Public repository without review
- **WHEN** `trust` is `public` and `review.mode` is `none`
- **THEN** validation fails, because generated code in a public repository always gets a human review

#### Scenario: Request by a non-maintainer
- **WHEN** `trust` is `public`, a maintainer applied `ready` and a collaborator who is not a maintainer applies `go`
- **THEN** no run starts and `go` is removed
