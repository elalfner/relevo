## ADDED Requirements

### Requirement: A build that stopped before it finished is continued with resume
`go` SHALL accept `--resume` with the number of a `build-failed` issue whose branch `feature/<n>-*` exists, and SHALL continue from that branch, building only the pending tasks and writing no specification. The planner SHALL apply the gates of a retry and move the issue from `build-failed` to `building`. `--retry` SHALL keep building from the beginning, and only when no branch exists.

#### Scenario: A build cut at a limit is resumed
- **WHEN** issue 42 is `build-failed`, its branch ends at `wip: stopped by limit (#42)` with the hash of the current text, and a person with write access runs `/relevo:go 42 --resume`
- **THEN** the issue becomes `building`, the run continues from the branch and builds only the tasks that are still open

#### Scenario: Resume on an issue that is not build-failed
- **WHEN** `--resume` is requested for an issue that is `built`
- **THEN** nothing changes and the message says that only a `build-failed` issue can be resumed

#### Scenario: Resume on an issue with no branch
- **WHEN** `--resume` is requested for a `build-failed` issue that has no branch on the remote
- **THEN** nothing changes and the message says that there is nothing to continue and that `--retry` builds it from the beginning

### Requirement: A resume is refused before the issue is claimed when the branch cannot be resumed
Before it claims the issue, the planner SHALL ask the resume check whether the branch can be continued, and SHALL refuse the resume, changing nothing, when it cannot. The message SHALL name the reason and the step that fits it. The planner SHALL NOT delete, reset or overwrite the branch.

#### Scenario: The text changed after the stop
- **WHEN** `--resume` is requested and the hash on the tip of the branch differs from the hash of the issue text
- **THEN** nothing changes, the issue stays `build-failed` and the message says that the text changed and to run `/relevo:issue <n>`

#### Scenario: Only the specification is on the branch
- **WHEN** `--resume` is requested and the branch holds only the specification
- **THEN** nothing changes and the message names the command that deletes the remote branch and the `--retry` to run afterwards

#### Scenario: QA rejected the work
- **WHEN** `--resume` is requested and the tip is `wip: rejected by QA`
- **THEN** nothing changes and the message sends the person to `/relevo:fix <n>`

#### Scenario: A person committed on the branch
- **WHEN** one commit over the base is not one of Relevo's
- **THEN** nothing changes and the message names the commit that deletes the remote branch and the `--retry` to run afterwards

#### Scenario: The branch cannot be read
- **WHEN** the content of the branch cannot be read
- **THEN** nothing is claimed, nothing is deleted and the message says that the branch could not be read

### Requirement: A build request resumes a failed build whose branch can be continued
A valid `go` label on a `build-failed` issue whose branch the resume check accepts SHALL be planned as a resume in the cloud, with the gates of a retry and without passing through `ready` again. When the branch cannot be resumed, the label SHALL be removed with the comment it gets today for a failed build with code. When the branch cannot be looked for, nothing SHALL be built and nothing SHALL change.

#### Scenario: Resume in the cloud
- **WHEN** issue 42 is `build-failed`, its branch ends at a checkpoint with the hash of the current text and a person with write access applies `go`
- **THEN** the gates run, the issue becomes `building` and the cloud continues from the branch

#### Scenario: The branch cannot be resumed
- **WHEN** a person applies `go` to a `build-failed` issue whose branch ends at `wip: rejected by QA`
- **THEN** `go` is removed and the comment says to run `/relevo:fix <n>`

#### Scenario: Local and cloud follow one rule
- **WHEN** the same branch is offered to `--resume` on a machine and to the `go` label in the cloud
- **THEN** both resume it, or both refuse it for the same reason

### Requirement: A resume that finishes no task stops the loop
When a resumed run stops again at a limit with no task finished, the `build-failed` comment SHALL say that resuming again will not help and what to change, SHALL NOT name `--resume`, and SHALL record the limits in force. A later `--resume` or `go` label SHALL be refused until a limit of `relevo.yml` is higher than the recorded one.

#### Scenario: A resume makes no progress
- **WHEN** a resumed run ends at the minutes limit with the same tasks done as when it started
- **THEN** the comment says that resuming again will not help, names the limits to raise and the option to split the issue, and does not name `--resume`

#### Scenario: Resume after the limit was raised
- **WHEN** the previous resume made no progress, `limits.run_max_minutes` is now higher than the recorded value and `--resume` is requested
- **THEN** the planner accepts it

#### Scenario: Resume with the same limits
- **WHEN** the previous resume made no progress, no limit is higher than the recorded one and `--resume` is requested
- **THEN** nothing changes and the message says which limits to raise

#### Scenario: A resume that finished tasks
- **WHEN** a resumed run finishes two tasks and then stops at a limit
- **THEN** the comment names `--resume` as the next step with the tasks done

## MODIFIED Requirements

### Requirement: A retry is refused when there is something to fix instead
The planner SHALL refuse a retry, changing nothing, when the issue is not `build-failed` or when a branch `feature/<n>-*` exists on the remote. The message SHALL send the person to `/relevo:go <n> --resume` when the branch can be resumed, to `/relevo:fix <n>` when it holds work that QA rejected, or to delete the branch.

#### Scenario: A branch exists
- **WHEN** `origin/feature/67-...` exists and the retry is requested
- **THEN** nothing changes and the message says to run `/relevo:go 67 --resume`, `/relevo:fix 67` or to delete the branch, according to what the branch holds

#### Scenario: The issue is not qa-failed
- **WHEN** the retry is requested for an issue that is `built`
- **THEN** nothing changes and the message says that only a `build-failed` issue can be retried

### Requirement: A refused retry on a branch with checkpoints says to use fix
When the planner refuses a retry because a branch `feature/<n>-*` exists on the remote and that branch holds code (checkpoints or the finished work), the message SHALL say that the branch holds code. When the resume check accepts the branch, the message SHALL send the person to `/relevo:go <n> --resume`; otherwise it SHALL send the person to `/relevo:fix <n>` and say that `fix` does not need a description of the defect when the branch ends at a commit that `go` made for a build that did not finish. The message for a branch that holds only the specification, and the one for a branch that cannot be read, SHALL NOT change.

#### Scenario: The branch holds checkpoints
- **WHEN** a retry is requested for `build-failed` issue 20 and `origin/feature/20-...` ends at a checkpoint with the hash of the current text
- **THEN** the message says the branch holds code, sends the person to `/relevo:go 20 --resume`, and the branch is untouched

#### Scenario: The branch holds code that cannot be resumed
- **WHEN** a retry is requested for `build-failed` issue 20 and the branch differs from the base outside the change folder but the resume check refuses it
- **THEN** the message says the branch holds code, sends the person to `/relevo:fix 20` and says no defect description is needed after an interrupted build, and the branch is untouched

#### Scenario: The branch cannot be read
- **WHEN** the content of the branch cannot be read
- **THEN** the message is the one for a branch that is corrected, and nothing is deleted

### Requirement: A build request is refused on an issue that cannot take it
A `go` label on an issue that is not `ready` SHALL start nothing and SHALL be removed, with one comment that says why and what applies instead, except on a failed build that left no code, which is rebuilt, and on a failed build whose branch can be resumed, which is continued. `go` SHALL NOT stand in for the approval.

#### Scenario: Draft
- **WHEN** a person applies `go` to an issue with no lifecycle label
- **THEN** `go` is removed and the comment says that the issue needs `ready` first

#### Scenario: Already building
- **WHEN** a person applies `go` to a `building` issue
- **THEN** `go` is removed, the comment says that the issue is being built, and the build in progress is not touched

#### Scenario: Failed build with code
- **WHEN** a person applies `go` to a `build-failed` issue whose branch holds implementation that the resume check refuses
- **THEN** `go` is removed and the comment says to run `/relevo:fix <n>`

#### Scenario: Already built
- **WHEN** a person applies `go` to a `built`, `in-review` or `pr-open` issue
- **THEN** `go` is removed and the comment says that the issue is already built
