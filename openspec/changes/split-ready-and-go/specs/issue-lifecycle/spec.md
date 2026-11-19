# Spec Delta

## ADDED Requirements

### Requirement: An issue without a lifecycle label is a draft
An open issue that carries no lifecycle label SHALL be a draft: its text is free to change, no gate looks at it and nothing builds it. An issue whose approval is withdrawn SHALL return to being a draft, with no lifecycle label.

#### Scenario: A reminder filed for later
- **WHEN** a person creates an issue with a title and one line, and applies no label
- **THEN** nothing evaluates or builds it, and `issue` can update it

#### Scenario: Approval withdrawn
- **WHEN** the `ready` label of an issue is removed and no other lifecycle label is applied
- **THEN** the issue is a draft again

### Requirement: The go label is a build request, not a state
The lifecycle SHALL have a `go` label (default name `relevo:go`) that asks the cloud to build an approved issue. It SHALL be added next to `ready` and SHALL NOT replace it, it SHALL be renamable in `labels` like the others, and it SHALL NOT change the owner of the issue. It SHALL be removed when the cloud decides about the issue, whatever the decision.

#### Scenario: Request on an approved issue
- **WHEN** a person with the permission of `ready` applies `relevo:go` to a `ready` issue
- **THEN** the cloud evaluates the issue, and after its decision the issue no longer carries `relevo:go`

#### Scenario: Request withdrawn
- **WHEN** a person moves a `queued` issue back to `ready` by hand
- **THEN** the issue is approved with no request, and the cloud does not build it until `go` is applied again

#### Scenario: Renamed label
- **WHEN** `labels.go` is set in `relevo.yml`
- **THEN** every behaviour of the label applies to the configured name

### Requirement: The local label marks a local build
The lifecycle SHALL have a `local` label (default name `relevo:local`) that marks an issue as being built on a person's machine. A local build SHALL add it next to `building` when it claims the issue, and it SHALL be removed in the same operation that takes the issue out of `building`. No person is asked to apply it. A `local` label on an issue that is not `building` SHALL mean nothing and SHALL be removed the next time a command changes the state of the issue. It SHALL be renamable in `labels`.

#### Scenario: Local build claimed
- **WHEN** a person starts a local build of issue 42 and its gates pass
- **THEN** issue 42 carries `relevo:building` and `relevo:local`

#### Scenario: Local build ends
- **WHEN** that build ends in `built` or in `build-failed`
- **THEN** `relevo:local` is removed together with `relevo:building`

#### Scenario: Stray label
- **WHEN** a `ready` issue carries `relevo:local`
- **THEN** the gates ignore the label, and it is removed when the issue next changes state

## MODIFIED Requirements

### Requirement: Lifecycle states with a single owner
An issue SHALL move through these states, each represented by a label and each having exactly one owner: `ready` (spec writer), `queued` (agent), `building` (agent), `built` (assignee), `in-review` (assignee), `pr-open` (peer). The final state is the issue being closed as completed; there is no `merged` label. `ready` SHALL be the approval of the issue: it says that the text is complete and is what should be built, and it SHALL start nothing by itself. An issue SHALL leave `ready` only when a build claims it, when a build request leaves it waiting, or when a gate sends it back.

#### Scenario: Normal path
- **WHEN** an issue is built successfully, reviewed on a device, opened as a pull request, approved and merged
- **THEN** it passes through `ready`, `building`, `built`, `in-review`, `pr-open` and ends closed as completed with no lifecycle label, having exactly one lifecycle label at any time before that

#### Scenario: One state at a time
- **WHEN** a command changes an issue's state
- **THEN** it removes the previous lifecycle label and adds the new one in the same operation

#### Scenario: Approved and waiting for a decision
- **WHEN** a person applies `ready` to an issue and nothing else
- **THEN** the issue stays `ready`, no build starts in the cloud or anywhere, and it waits until someone requests the build or starts it on a machine

### Requirement: The urgent label is a request, not a state
The lifecycle SHALL have an `urgent` label (default name `relevo:urgent`) that asks for an issue to be started before the others and without waiting for the assignee's review capacity. It SHALL be added next to the current state and SHALL NOT replace it, it SHALL be renamable in `labels` like the others, and it SHALL NOT change the owner or the next step of the issue. It SHALL NOT close the issue to editing: an issue that is `needs-spec` and `urgent` can still be corrected by its spec writer. It SHALL be a request for cloud builds alone: on a `ready` issue it waits with the issue and takes effect when the build is requested, and a local build SHALL ignore it.

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

#### Scenario: Urgent on an approved issue with no request
- **WHEN** a `ready` issue carries `relevo:urgent` and nobody has applied `go`
- **THEN** nothing starts, and the label takes effect when `go` is applied

#### Scenario: Urgent and a local build
- **WHEN** a person starts a local build of an issue that carries `relevo:urgent`
- **THEN** the build starts or not exactly as it would without the label
