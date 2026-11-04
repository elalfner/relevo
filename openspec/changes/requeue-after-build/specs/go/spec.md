# Spec Delta

## ADDED Requirements

### Requirement: A finished build starts the queue
When a cloud build run ends, whatever its outcome, the `go` workflow SHALL start a queue evaluation (`relevo-queue`) after the labels of the outcome are set, because labels changed with the workflow token start no workflow by themselves. It SHALL also do so when the light job fails after claiming the issue.

#### Scenario: A build ends with `built`
- **WHEN** a build finishes and the issue is `built` while other issues are `queued`
- **THEN** the queue is evaluated right away and the oldest eligible `queued` issue starts, without waiting for the schedule

#### Scenario: A build fails or is cut
- **WHEN** a build ends as `qa-failed`, `needs-spec`, cancelled or timed out
- **THEN** the queue is evaluated right away

#### Scenario: The light job fails after the claim
- **WHEN** the gates claim the issue as `building` and the light job then fails, leaving it `qa-failed`
- **THEN** the queue is evaluated right away

#### Scenario: No build ran
- **WHEN** the decision is `needs-spec`, `blocked`, `queued`, `denied`, no milestone or no assignee, and the light job succeeds
- **THEN** no queue evaluation is started, because no slot was freed

#### Scenario: The queue workflow is missing
- **WHEN** the repository has no `relevo-queue` workflow
- **THEN** the start fails without failing the run or changing any label

### Requirement: Starting the queue does not widen the agent's token
The permission to start workflows SHALL be held only by a job that runs no agent and no project code. The job that runs the agent SHALL NOT have it.

#### Scenario: Permissions of the jobs
- **WHEN** the workflow template is read
- **THEN** only the job that starts the queue has `actions: write`, and the `decide` and `build` jobs do not
