# Spec Delta

## ADDED Requirements

### Requirement: A build request needs the permission of ready
A `go` label SHALL be valid only when the person who last applied it has the permission that `ready` requires: write or maintain access, and maintain access only when `trust` is `public`. When it is not valid, the label SHALL be removed, one comment SHALL say why and name who applied it, and the issue SHALL stay `ready`. A label applied by an application or a bot SHALL NOT be valid.

#### Scenario: Request by someone without write access
- **WHEN** a user without write access applies `go` to a `ready` issue
- **THEN** no run starts, `go` is removed, the issue stays `ready` and one comment says that `go` needs the permission of `ready`

#### Scenario: Public repository
- **WHEN** `trust` is `public` and a collaborator with write but not maintain access applies `go`
- **THEN** `go` is removed and the comment says that only a maintainer may request a build

#### Scenario: Applied by a bot
- **WHEN** an application applies `go`
- **THEN** no run starts and the label is removed

### Requirement: A build request is refused on an issue that cannot take it
A `go` label on an issue that is not `ready` SHALL start nothing and SHALL be removed, with one comment that says why and what applies instead, except on a failed build that left no code, which is rebuilt. `go` SHALL NOT stand in for the approval.

#### Scenario: Draft
- **WHEN** a person applies `go` to an issue with no lifecycle label
- **THEN** `go` is removed and the comment says that the issue needs `ready` first

#### Scenario: Already building
- **WHEN** a person applies `go` to a `building` issue
- **THEN** `go` is removed, the comment says that the issue is being built, and the build in progress is not touched

#### Scenario: Failed build with code
- **WHEN** a person applies `go` to a `build-failed` issue whose branch holds implementation
- **THEN** `go` is removed and the comment says to run `/relevo:fix <n>`

#### Scenario: Already built
- **WHEN** a person applies `go` to a `built`, `in-review` or `pr-open` issue
- **THEN** `go` is removed and the comment says that the issue is already built

### Requirement: A build request rebuilds a failed build that left no code
A valid `go` label on a `build-failed` issue that has no branch on the remote SHALL be planned as a retry in the cloud, with the gates of any other issue and without passing through `ready` again, provided that the text has not changed since the approval. The claim SHALL move the issue from `build-failed` to `building`.

#### Scenario: Rebuild in the cloud
- **WHEN** issue 67 is `build-failed` with no branch, its text is the approved one, and a person with write access applies `go`
- **THEN** the gates run, the issue becomes `building` and the cloud builds it

#### Scenario: Text changed since the approval
- **WHEN** the body of that issue was edited after `ready` was last applied
- **THEN** nothing is built, `go` is removed and the comment asks for a new approval

### Requirement: A build request is consumed by the first decision
The `go` label SHALL be removed by the decision the cloud takes about the issue, whatever it is: start, queue, block, send back, refuse. An issue that the decision left `queued` or `blocked` SHALL be built by the cloud when it becomes eligible, with no second request. An issue that the decision sent back SHALL need a new request after it is approved again.

#### Scenario: Left waiting
- **WHEN** `go` is applied to a `ready` issue and the limit of agents is reached
- **THEN** the issue is `queued` without `go`, and it starts when a slot frees up

#### Scenario: Sent back and corrected
- **WHEN** `go` is applied, the gate sends the issue to `needs-spec`, and the writer corrects it and applies `ready`
- **THEN** nothing starts until `go` is applied again

### Requirement: The queue acts on waiting issues and on unanswered requests
The queue SHALL act on issues that are `queued` or `blocked`, and on a `ready` issue whose `go` label the `go` workflow did not answer. A request that has just been made SHALL belong to the `go` workflow that the label started: the queue SHALL NOT apply its decision or dispatch a build for it. Two runs for one issue SHALL NOT build it twice.

#### Scenario: Request just made
- **WHEN** `go` is applied and the queue and the `go` workflow both start on that event
- **THEN** only the `go` workflow decides about the issue, and its comment is posted once

#### Scenario: Waiting issue becomes eligible
- **WHEN** a `queued` or `blocked` issue becomes eligible
- **THEN** the queue starts it

#### Scenario: Request made while the cloud was paused
- **WHEN** `go` was applied while `RELEVO_CLOUD_GO` was `off`, the issue is still `ready` with `go`, and the cloud resumes
- **THEN** the queue serves the request at its next evaluation, with nothing applied again

#### Scenario: Approved issue with no request
- **WHEN** an issue is `ready` and carries no `go` label
- **THEN** the queue does not look at it

### Requirement: The limit of agents counts cloud builds only
`limits.concurrent_agents` SHALL limit the builds of the cloud. An issue that is `building` with the `local` label SHALL NOT count against it, and a local build SHALL NOT wait for it.

#### Scenario: Local builds do not take slots
- **WHEN** the limit is 2, two issues are `building` with `local`, and `go` is applied to a third issue
- **THEN** the third issue starts in the cloud

#### Scenario: Cloud builds do
- **WHEN** the limit is 2, two issues are `building` without `local`, and `go` is applied to a third issue
- **THEN** the third issue is `queued`

## REMOVED Requirements

### Requirement: The queue only acts on waiting issues
**Reason**: The trigger is now the `go` label, and a request that the `go` workflow did not answer (the cloud was paused) is served by the queue; the scenario "Issue just marked ready" no longer describes anything that starts a run.
**Migration**: Replaced by "The queue acts on waiting issues and on unanswered requests".

## MODIFIED Requirements

### Requirement: Trigger
A cloud build SHALL start only for an issue that belongs to a milestone, has an assignee, carries the `ready` label and receives the `go` label, and only when both labels were applied by users with write permission on the repository. The `ready` label alone SHALL start nothing.

#### Scenario: Authorised label
- **WHEN** a collaborator with write access applies `go` to a `ready` issue in a milestone that a collaborator with write access approved
- **THEN** the issue is evaluated by the gates

#### Scenario: Unauthorised label
- **WHEN** the `ready` label of the issue was applied by a user without write access and a build is requested or started
- **THEN** no run starts, and the `ready` and `go` labels are removed

#### Scenario: No milestone
- **WHEN** a build is requested for a `ready` issue with no milestone
- **THEN** no run starts, the `ready` and `go` labels are removed and a comment asks for a milestone

#### Scenario: No assignee
- **WHEN** a build is requested for a `ready` issue with no assignee
- **THEN** no run starts, the `ready` and `go` labels are removed and a comment asks for an assignee, because there would be nobody to hand the result to

#### Scenario: Approval alone
- **WHEN** a collaborator with write access applies `ready` to an issue and nobody applies `go`
- **THEN** no workflow run builds the issue

### Requirement: Gate 3, capacity
A cloud build SHALL NOT start for an assignee who already has `limits.built_unreviewed_per_person` issues in `built`, unless the issue carries a valid `urgent` label. A valid `urgent` label SHALL skip this gate only: every other gate and the limit `limits.concurrent_agents` still apply to the issue. The gate SHALL NOT apply to a local build.

#### Scenario: Assignee at capacity
- **WHEN** the assignee has 2 issues in `built` and the limit is 2
- **THEN** the issue is labelled `queued`, one comment says the assignee is at the limit (without mentioning anyone), and it starts when the assignee's count drops below the limit

#### Scenario: Urgent issue for an assignee at capacity
- **WHEN** the assignee has 2 issues in `built`, the limit is 2, the issue carries a valid `urgent` label and an agent slot is free
- **THEN** the issue starts, and the assignee then has 3 issues in `built` once it finishes

#### Scenario: Urgent issue is still blocked by a dependency
- **WHEN** the issue carries a valid `urgent` label and a `Depends-on` issue is not merged
- **THEN** the issue is labelled `blocked`, and the notice says that `urgent` does not skip dependencies

#### Scenario: Urgent issue with an incomplete spec
- **WHEN** the issue carries a valid `urgent` label and its spec is incomplete
- **THEN** the issue is labelled `needs-spec` as for any other issue

#### Scenario: Urgent issue and no free agent slot
- **WHEN** the issue carries a valid `urgent` label and `limits.concurrent_agents` agents are already running
- **THEN** the issue is labelled `queued`, one comment says it waits for a free agent slot, and it is the first to start when a slot frees up

#### Scenario: Local build for an assignee at capacity
- **WHEN** the assignee has 2 issues in `built`, the limit is 2, and a person starts a local build of an issue assigned to them
- **THEN** the build starts

### Requirement: Concurrency and cost limits
`go` SHALL run at most one agent per issue and at most `limits.concurrent_agents` agents in the cloud overall. A run that exceeds `limits.run_max_turns` or `limits.run_max_cost` SHALL be stopped by the runner: the agent cannot see its own counters and does not try to stop itself.

#### Scenario: Duplicate trigger
- **WHEN** the label event fires twice for the same issue
- **THEN** only one run executes

#### Scenario: Run exceeds its budget
- **WHEN** a run reaches its turn or cost limit
- **THEN** the runner stops it, the agent pushes nothing, and the final step of the workflow labels the issue `build-failed` and comments with the job status and a link to the run

#### Scenario: Retry after a budget cut
- **WHEN** the person requests the build again after a run was cut by its limits and left no branch
- **THEN** the issue is evaluated like any other, because the cut run pushed no branch

### Requirement: Without a credential the gate does not claim the issue
When the workflow tells the gate that no model credential exists, a `start` decision SHALL NOT claim the issue, SHALL leave it `ready`, SHALL remove the `go` label and SHALL produce the local-run comment instead; every other decision SHALL be applied as usual.

#### Scenario: Start without credential
- **WHEN** the gates pass and no credential exists
- **THEN** the output action is `local`, the issue keeps `relevo:ready` and loses `relevo:go`, and the comment names `/relevo:go <n>`

#### Scenario: Other decisions
- **WHEN** the issue is blocked, needs a spec or is queued and no credential exists
- **THEN** the decision is applied as without the flag
