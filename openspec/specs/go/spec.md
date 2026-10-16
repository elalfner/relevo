# go Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.
## Requirements
### Requirement: Trigger
`go` SHALL start only for an issue that belongs to a milestone and carries the `ready` label, and only when the label was applied by a user with write permission on the repository.

#### Scenario: Authorised label
- **WHEN** a collaborator with write access applies `ready` to an issue in a milestone
- **THEN** the issue is evaluated by the gates

#### Scenario: Unauthorised label
- **WHEN** a user without write access applies `ready`
- **THEN** no run starts and the label is removed

#### Scenario: No milestone
- **WHEN** `ready` is applied to an issue with no milestone
- **THEN** no run starts, the `ready` label is removed and a comment asks for a milestone

#### Scenario: No assignee
- **WHEN** `ready` is applied to an issue with no assignee
- **THEN** no run starts, the `ready` label is removed and a comment asks for an assignee, because there would be nobody to hand the result to

### Requirement: Gate 1, spec
Before building, `go` SHALL verify that the issue states scenarios and edge cases. It SHALL NOT invent them.

#### Scenario: Spec incomplete
- **WHEN** the issue has no scenarios or no edge cases
- **THEN** it is labelled `needs-spec`, assigned back to the spec writer with a comment listing what is missing, and no build starts

### Requirement: Gate 2, dependencies
`go` SHALL NOT build an issue whose `Depends-on` issues are not all merged.

#### Scenario: Blocked
- **WHEN** a dependency is open
- **THEN** the issue is labelled `blocked` and the queue moves to the next eligible issue

### Requirement: Gate 3, capacity
`go` SHALL NOT start an issue for an assignee who already has `limits.built_unreviewed_per_person` issues in `built`.

#### Scenario: Assignee at capacity
- **WHEN** the assignee has 2 issues in `built` and the limit is 2
- **THEN** the issue is labelled `queued`, one comment says the assignee is at the limit (without mentioning anyone), and it starts when the assignee's count drops below the limit

### Requirement: Queue order
Eligible issues SHALL be started in first-in-first-out order of the time `ready` was applied. An ineligible issue SHALL be skipped without blocking the others and SHALL keep its position.

#### Scenario: Head of line is blocked
- **WHEN** the oldest issue is `blocked` and a newer issue is eligible
- **THEN** the newer issue starts, and the older one starts first once it becomes eligible

### Requirement: Concurrency and cost limits
`go` SHALL run at most one agent per issue, at most `limits.concurrent_agents` agents overall, and SHALL stop a run that exceeds `limits.run_max_turns` or `limits.run_max_cost`.

#### Scenario: Duplicate trigger
- **WHEN** the label event fires twice for the same issue
- **THEN** only one run executes

#### Scenario: Run exceeds its budget
- **WHEN** a run reaches its turn or cost limit
- **THEN** it stops, the branch is pushed, the issue is labelled `qa-failed` with the reason "budget exceeded"

### Requirement: The workflow enforces the limits
The workflow that runs `go` SHALL start only when a person (not an automation account) applies the `ready` label, SHALL group runs per issue without cancelling a run in progress, SHALL pass the turn and cost limits to the agent runner, and SHALL end a run after a fixed time limit. The cost limit is enforced by the runner, not by the agent.

#### Scenario: Label applied by an automation
- **WHEN** an automation account applies `ready`
- **THEN** the workflow does not start

#### Scenario: Run takes too long
- **WHEN** a run exceeds the workflow time limit
- **THEN** the runner stops it; if the workflow can still run its final step, that step reports the run on the issue (see "A run that ends without an outcome is reported"), otherwise the issue stays `building` until a person resets it

### Requirement: The gates run before the build setup
The workflow that runs `go` SHALL run the gates and claim the issue in a light job that installs no platform toolchain and starts no agent, and SHALL start the build job, with the toolchain and the agent, only when the decision is `start`. The decision SHALL travel to the build job so that it does not plan again.

#### Scenario: Issue not ready to build
- **WHEN** the gates decide `needs-spec`, `blocked`, `queued`, `denied`, no milestone or no assignee
- **THEN** the light job applies the outcome and its comment, and the build job does not start

#### Scenario: Gates pass
- **WHEN** the gates decide `start`
- **THEN** the light job marks the issue `building`, the build job starts, and the agent receives the decision instead of planning again

#### Scenario: Second dispatch for the same issue
- **WHEN** a second run is dispatched for an issue that the first run already claimed or built
- **THEN** it waits for the first run, finds nothing to start in the light job, and the build job does not start

#### Scenario: The light job fails
- **WHEN** the light job fails and the issue is still `ready`, `queued` or `building`
- **THEN** the issue is labelled `qa-failed` and a comment links the run

### Requirement: Builds started by the queue are accepted
The workflow SHALL accept a build dispatched by the queue workflow, whose actor is the Actions bot, and SHALL allow that one bot only. It SHALL NOT allow every bot, because that would let outside applications start runs.

#### Scenario: The queue starts a build
- **WHEN** the queue dispatches the `go` workflow for an eligible issue
- **THEN** the agent runner accepts the run although its actor is the Actions bot

#### Scenario: Another bot starts a run
- **WHEN** a bot other than the Actions bot starts the workflow
- **THEN** the agent runner refuses it

### Requirement: A run that ends without an outcome is reported
The workflow that runs `go` SHALL end with a step that always runs. When the issue is still `ready` or `building` after the agent step, that step SHALL replace the label with `qa-failed` and SHALL comment, mentioning the assignee, with the job status and a link to the run, so no failure before or during the agent is silent. When the issue carries any other state, the step SHALL NOT change it.

#### Scenario: The plugin cannot be installed
- **WHEN** the run fails before `go` starts and the issue is still `ready`
- **THEN** the issue is labelled `qa-failed` and a comment links the run

#### Scenario: The agent ends its session early
- **WHEN** the job succeeds but the issue is still `building`
- **THEN** the issue is labelled `qa-failed` and a comment links the run

#### Scenario: A dispatched run fails before claiming the issue
- **WHEN** the job fails and the issue is still `queued`
- **THEN** the issue is labelled `qa-failed` and a comment links the run, so the queue does not dispatch it again every evaluation

#### Scenario: A run ends normally with the issue queued
- **WHEN** the job succeeds and the issue is `queued` because there was no capacity
- **THEN** the final step changes nothing

#### Scenario: The run recorded its outcome
- **WHEN** the issue is `built`, `queued`, `blocked`, `needs-spec` or `qa-failed` when the job ends
- **THEN** the final step changes nothing

### Requirement: Labels follow the run
`go` SHALL set `queued` while an issue waits for capacity, `building` when its run starts, and `built` when it finishes successfully, removing the previous lifecycle label each time.

#### Scenario: Run starts
- **WHEN** a run starts for a `queued` issue
- **THEN** `queued` is replaced by `building`

### Requirement: Build without pauses
After the gates pass, `go` SHALL create the change specification from the issue, create the branch from the base branch, implement the tasks, and run QA, without waiting for human approval of the generated specification.

#### Scenario: Happy path
- **WHEN** all gates pass
- **THEN** a branch `feature/<n>-<slug>` is created from the current base branch, the tasks are implemented and QA passes

### Requirement: Adversarial QA with one retry
QA SHALL compare the diff against the issue's scenarios and the project rules in `qa.rules_from`, run the platform's static analysis and tests, and return `QA PASSED` or `QA REJECTED` with file, line and reason. On rejection the developer agent SHALL get exactly `qa.retries` attempts to fix, then QA SHALL run again.

#### Scenario: QA passes after a retry
- **WHEN** the first QA run rejects and the second passes
- **THEN** the build proceeds as passed

#### Scenario: QA still rejects
- **WHEN** QA rejects after the allowed retries
- **THEN** the branch is pushed, the issue is labelled `qa-failed`, the assignee is mentioned with the QA report, no pull request is opened and the state does not advance

#### Scenario: Task marked done without code
- **WHEN** a task is checked off without code that implements it
- **THEN** QA rejects and names the task

#### Scenario: Validation tooling missing
- **WHEN** QA cannot run static analysis or tests because the tooling is not available
- **THEN** QA rejects with the finding "automated validation could not run" and never passes code it could not check

#### Scenario: Device-only scenario
- **WHEN** a scenario can only be observed on a device or in another app
- **THEN** QA does not reject it for lacking a test, checks that the code plausibly produces it, and lists it as left for on-device review

#### Scenario: Verdict line
- **WHEN** QA finishes
- **THEN** the first line of its output is exactly `QA PASSED` or `QA REJECTED`

### Requirement: Safe commits
Before committing, `go` SHALL stage files explicitly (never "add all") and SHALL scan the staged diff for temporary markers (`NOCOMMIT`, `TEMP`, `DO NOT COMMIT`) and credential patterns, aborting on any match.

#### Scenario: Temporary marker staged
- **WHEN** the staged diff contains `NOCOMMIT`
- **THEN** the commit is aborted and the assignee is told which file

#### Scenario: Credential found before pushing
- **WHEN** the staged diff contains a possible credential
- **THEN** nothing is pushed, the issue is labelled `qa-failed` with that reason, and the comment states that the branch was not pushed

### Requirement: Unrecoverable problems end in qa-failed
Any problem `go` cannot recover from SHALL end in the `qa-failed` exit with a stated reason, and SHALL push the branch except when the reason is a possible credential or temporary marker. `go` SHALL NOT open a pull request or advance the state in that case.

#### Scenario: Branch already exists
- **WHEN** the feature branch already exists on the remote
- **THEN** `go` leaves it untouched and ends in `qa-failed` with the reason "branch already exists"

#### Scenario: Specification invalid
- **WHEN** the generated change specification still fails validation after two corrections
- **THEN** `go` ends in `qa-failed` with the reason "specification invalid"

#### Scenario: Ambiguity that changes behaviour
- **WHEN** the issue is ambiguous in a way that changes observable behaviour
- **THEN** `go` does not guess: the issue is labelled `needs-spec`, assigned to the spec writer, and nothing is pushed

### Requirement: Successful hand-off
On `QA PASSED`, `go` SHALL push the branch, label the issue `built`, and post the hand-off message to the assignee.

#### Scenario: Built
- **WHEN** QA passes
- **THEN** the issue is `built`, the branch is pushed and the assignee is mentioned once

### Requirement: The queue only acts on waiting issues
The queue SHALL act only on issues that are already `queued` or `blocked`. An issue that has just been marked `ready` is handled by the `go` workflow that the label started, so the queue SHALL NOT apply its decision or dispatch a build for it.

#### Scenario: Issue just marked ready
- **WHEN** an issue is labelled `ready` and the queue and the `go` workflow both start on that event
- **THEN** only the `go` workflow decides about it, and its comment is posted once

#### Scenario: Waiting issue becomes eligible
- **WHEN** a `queued` or `blocked` issue becomes eligible
- **THEN** the queue starts it

### Requirement: Queue re-evaluation
The queue SHALL be re-evaluated on every relevant event (an issue merged, a `built` issue leaving that state, a label change) and on a schedule, so a lost event does not stall the queue.

#### Scenario: Capacity frees up
- **WHEN** the assignee's `built` issue moves to `in-review` (set by `review` when the person starts the review)
- **THEN** the oldest eligible `queued` issue for that assignee starts

