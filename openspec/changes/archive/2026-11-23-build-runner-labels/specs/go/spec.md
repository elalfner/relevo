# Spec Delta

## ADDED Requirements

### Requirement: The build job runs on the build runner
The build job of the `go` workflow SHALL run on the labels of `runner.build_labels` when it is set, and every other job of that workflow SHALL run on `runner.labels`. How many runners carry the labels of the build job SHALL be how many cloud builds a machine runs at once, across the repositories that use them; a build job that finds none free SHALL wait in the queue of GitHub. The queue of Relevo SHALL NOT look at which runners are free.

#### Scenario: One build runner, two repositories
- **WHEN** two repositories use the same single build runner and a build is requested in each at the same time
- **THEN** one build runs and the other waits for the runner, while the light jobs of both run on the other runners

#### Scenario: A build does not hold the light jobs
- **WHEN** a build is running and a review event arrives
- **THEN** the job that syncs the label runs at once, on a runner of `runner.labels`

### Requirement: A build that never found a runner returns to the queue
When the build job of an issue that was claimed ends without having started, because no runner took it, the workflow SHALL return the issue to `queued` and post one comment that says that no runner took the build. It SHALL NOT label it `build-failed`. A build job that started and was then cancelled or cut SHALL be reported as today.

#### Scenario: GitHub cancels a job that waited too long
- **WHEN** the build job of issue 42 is cancelled while it waits for a runner
- **THEN** issue 42 is `queued`, one comment says that no runner took the build, and the queue tries again at its next evaluation

#### Scenario: Cancelled while running
- **WHEN** the build job of issue 42 started, and is then cancelled
- **THEN** the issue is handled as a run that was cut, not returned to the queue for this reason

## MODIFIED Requirements

### Requirement: A cloud build shows its progress in one comment
From the moment a cloud build is claimed, `go` SHALL keep one progress comment on the issue, found by a hidden marker and edited in place. It SHALL NOT add a comment for each step or each check. The comment SHALL show the state now and SHALL NOT accumulate history: that the build waits for a runner until the build job starts, and then the phase of the build, the tasks done out of the total and how long the run has lasted, in whole minutes.

#### Scenario: First report
- **WHEN** the decision job claims the issue
- **THEN** one progress comment with the marker is created on the issue, and it says that the build waits for a runner

#### Scenario: A step finishes
- **WHEN** the number of tasks done or the phase changes
- **THEN** the existing progress comment is edited and no new comment is posted

#### Scenario: Marker already present
- **WHEN** a progress comment with the marker already exists for the issue
- **THEN** it is edited and no second one is created

#### Scenario: The build job starts
- **WHEN** a runner takes the build job
- **THEN** the same comment is edited to show the phase, and the minutes count from that start

### Requirement: A run that ends without an outcome is reported
The workflow that runs `go` SHALL end with a step that always runs. When the issue is still `ready` or `building` after the agent step, that step SHALL replace the label with `build-failed` and SHALL comment, mentioning the assignee, with the job status and a link to the run, so no failure before or during the agent is silent. When the issue carries any other state, the step SHALL NOT change it. A build job that never started is not such a failure: the issue returns to `queued` instead.

#### Scenario: The plugin cannot be installed
- **WHEN** the run fails before `go` starts and the issue is still `ready`
- **THEN** the issue is labelled `build-failed` and a comment links the run

#### Scenario: The agent ends its session early
- **WHEN** the job succeeds but the issue is still `building`
- **THEN** the issue is labelled `build-failed` and a comment links the run

#### Scenario: A dispatched run fails before claiming the issue
- **WHEN** the job fails and the issue is still `queued`
- **THEN** the issue is labelled `build-failed` and a comment links the run, so the queue does not dispatch it again every evaluation

#### Scenario: A run ends normally with the issue queued
- **WHEN** the job succeeds and the issue is `queued` because there was no capacity
- **THEN** the final step changes nothing

#### Scenario: The run recorded its outcome
- **WHEN** the issue is `built`, `queued`, `blocked`, `needs-spec` or `build-failed` when the job ends
- **THEN** the final step changes nothing

#### Scenario: The build job never started
- **WHEN** the issue is `building`, its progress comment still says that the build waits for a runner, and the build job ended
- **THEN** the issue is returned to `queued` and is not labelled `build-failed`
