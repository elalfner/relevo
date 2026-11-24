# Spec Delta

## MODIFIED Requirements

### Requirement: Trigger
A cloud build SHALL start only for an issue that has an assignee, carries the `ready` label and receives the `go` label, and only when both labels were applied by users with write permission on the repository. The `ready` label alone SHALL start nothing. A milestone SHALL NOT be required: an issue without one is evaluated like any other.

#### Scenario: Authorised label
- **WHEN** a collaborator with write access applies `go` to a `ready` issue that a collaborator with write access approved
- **THEN** the issue is evaluated by the gates

#### Scenario: Unauthorised label
- **WHEN** the `ready` label of the issue was applied by a user without write access and a build is requested or started
- **THEN** no run starts, and the `ready` and `go` labels are removed

#### Scenario: No milestone
- **WHEN** a build is requested for a `ready` issue with an assignee and no milestone
- **THEN** the issue passes this gate and is evaluated by the others, and no comment asks for a milestone

#### Scenario: No assignee
- **WHEN** a build is requested for a `ready` issue with no assignee
- **THEN** no run starts, the `ready` and `go` labels are removed and a comment asks for an assignee, because there would be nobody to hand the result to

#### Scenario: Approval alone
- **WHEN** a collaborator with write access applies `ready` to an issue and nobody applies `go`
- **THEN** no workflow run builds the issue

### Requirement: The gates run before the build setup
The workflow that runs `go` SHALL run the gates and claim the issue in a light job that installs no platform toolchain and starts no agent, and SHALL start the build job, with the toolchain and the agent, only when the decision is `start`. The decision SHALL travel to the build job so that it does not plan again.

#### Scenario: Issue not ready to build
- **WHEN** the gates decide `needs-spec`, `blocked`, `queued`, `denied` or no assignee
- **THEN** the light job applies the outcome and its comment, and the build job does not start

#### Scenario: Gates pass
- **WHEN** the gates decide `start`
- **THEN** the light job marks the issue `building`, the build job starts, and the agent receives the decision instead of planning again

#### Scenario: Second dispatch for the same issue
- **WHEN** a second run is dispatched for an issue that the first run already claimed or built
- **THEN** it waits for the first run, finds nothing to start in the light job, and the build job does not start

#### Scenario: The light job fails
- **WHEN** the light job fails and the issue is still `ready`, `queued` or `building`
- **THEN** the issue is labelled `build-failed` and a comment links the run

### Requirement: A finished build starts the queue
When a cloud build run ends, whatever its outcome, the `go` workflow SHALL start a queue evaluation (`relevo-queue`) after the labels of the outcome are set, because labels changed with the workflow token start no workflow by themselves. It SHALL also do so when the light job fails after claiming the issue.

#### Scenario: A build ends with `built`
- **WHEN** a build finishes and the issue is `built` while other issues are `queued`
- **THEN** the queue is evaluated right away and the oldest eligible `queued` issue starts, without waiting for the schedule

#### Scenario: A build fails or is cut
- **WHEN** a build ends as `build-failed`, `needs-spec`, cancelled or timed out
- **THEN** the queue is evaluated right away

#### Scenario: The light job fails after the claim
- **WHEN** the gates claim the issue as `building` and the light job then fails, leaving it `build-failed`
- **THEN** the queue is evaluated right away

#### Scenario: No build ran
- **WHEN** the decision is `needs-spec`, `blocked`, `queued`, `denied` or no assignee, and the light job succeeds
- **THEN** no queue evaluation is started, because no slot was freed

#### Scenario: The queue workflow is missing
- **WHEN** the repository has no `relevo-queue` workflow
- **THEN** the start fails without failing the run or changing any label

### Requirement: A build-failed issue without a branch can be retried
When the planner is asked to retry an issue (`--retry`, together with `--only <n>`), it SHALL treat that issue, when it is `build-failed`, as if it were `ready`: the same gates apply and the claim SHALL move it from `build-failed` to `building`. It SHALL NOT add or require the `ready` label, and the claim SHALL post no comment of its own. In place of the person who applied `ready` it SHALL use the person who runs the retry: only write access, or a maintainer when `trust` is `public`, may retry.

#### Scenario: Retry of a qa-failed issue without a branch
- **WHEN** issue 67 is `build-failed`, has no remote branch, and a person with write access runs the planner with `--only 67 --retry --apply --claim`
- **THEN** the decision is `start`, the issue loses `build-failed` and gains `building`, no `ready` label is added and no comment is posted

#### Scenario: The person may not start work
- **WHEN** the person who runs the retry has only read access, or `trust` is `public` and the person is not a maintainer
- **THEN** the decision is `denied` and nothing is claimed

#### Scenario: Gates still apply
- **WHEN** the retried issue has no assignee or an incomplete specification
- **THEN** the same decision as for a `ready` issue is returned, and nothing is built

#### Scenario: A retried issue without a milestone
- **WHEN** the retried issue has no milestone and passes the other gates
- **THEN** the decision is `start`, as for a `ready` issue without one

#### Scenario: Without the flag
- **WHEN** the planner runs without `--retry`
- **THEN** a `build-failed` issue is still ignored
