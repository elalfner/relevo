## ADDED Requirements

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
- **THEN** no run starts and a comment asks for a milestone

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
- **THEN** the issue is labelled `queued` and starts when the assignee's count drops below the limit

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

### Requirement: Successful hand-off
On `QA PASSED`, `go` SHALL push the branch, label the issue `built`, and post the hand-off message to the assignee.

#### Scenario: Built
- **WHEN** QA passes
- **THEN** the issue is `built`, the branch is pushed and the assignee is mentioned once

### Requirement: Queue re-evaluation
The queue SHALL be re-evaluated on every relevant event (an issue merged, a `built` issue leaving that state, a label change) and on a schedule, so a lost event does not stall the queue.

#### Scenario: Capacity frees up
- **WHEN** the assignee's `built` issue moves to `in-review` (set by `review` when the person starts the review)
- **THEN** the oldest eligible `queued` issue for that assignee starts
