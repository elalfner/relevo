# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: A local run can retry a qa-failed issue`
- TO: `### Requirement: A local run can retry a build-failed issue`

## MODIFIED Requirements

### Requirement: A usage limit is reported as a usage limit
When a cloud run ends because the usage limit, the quota or the credit was reached, the final step SHALL say so and say when the issue will retry (see the capability `usage-limit-retry`), instead of the generic "ended without a result" and instead of telling a person to apply `ready` again later. When the retry is not possible (the retries are used up or the work could not be kept) it SHALL say so and ask a person.

#### Scenario: Limit reached
- **WHEN** the execution log of the failed run shows that a usage limit was reached: its final result is an error whose text says so, or a rate-limit event has a status other than `allowed`
- **THEN** the issue returns to the queue with a retry time, is not marked `build-failed`, and the comment says the usage limit was reached and when it will retry

#### Scenario: Retries used up
- **WHEN** the run of the third retry ends at a usage limit
- **THEN** the issue is marked `build-failed` and the comment says the usage limit was reached again and asks a person

#### Scenario: Another failure
- **WHEN** the run failed for any other reason, including a log whose rate-limit events all report `allowed`
- **THEN** the comment is the generic one with the link to the run

### Requirement: A local run can retry a build-failed issue
`go-local.mjs <issue> --retry` SHALL run `/relevo:go <issue> --retry` in the same worktree, with the same limits and tool lists, and `/relevo:go <issue> --local --retry` SHALL run it. `go` with `--retry` SHALL plan and claim the issue with the planner's `--retry`. Because the issue is never labelled `ready`, the cloud workflow SHALL NOT start, and the warning that the cloud can also build the issue SHALL NOT be shown for a retry.

#### Scenario: Local retry
- **WHEN** the person runs `go-local.mjs 67 --retry`
- **THEN** a worktree is created and the agent runs `/relevo:go 67 --retry` there, with the limits and flags of the workflow

#### Scenario: Local flag with retry
- **WHEN** the person runs `/relevo:go 67 --local --retry`
- **THEN** the skill runs `go-local.mjs 67 --retry`, shows its output and does not build in the session

#### Scenario: No cloud warning
- **WHEN** the cloud is able to build and the run is a retry
- **THEN** no warning about the cloud is printed, because the issue is not `ready`
