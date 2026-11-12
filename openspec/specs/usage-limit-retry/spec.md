# usage-limit-retry Specification

## Purpose
What happens to an issue whose cloud run stopped because the account reached its usage limit: it returns to the queue by itself with a stated retry time, within a bound, without discarding work, and without all the waiting issues starting at once.

## Requirements

### Requirement: A run stopped by a usage limit returns to the queue with a retry time
When a cloud run ends because the usage limit, the quota or the credit of the model account was reached, the final step SHALL return the issue to `queued` (not `qa-failed`) and post one comment that says when it will retry. The comment SHALL carry a hidden marker with the retry time and the attempt number, and SHALL mention the assignee.

#### Scenario: The log names the reset
- **WHEN** a run ends at a usage limit and the rate-limit event of its log gives a reset time in the future
- **THEN** the issue is `queued`, not `qa-failed`, and one comment says it will retry after that time, in UTC

#### Scenario: The log does not name the reset
- **WHEN** a run ends at a usage limit and the log has no reset time, or one that is in the past or more than 8 days away
- **THEN** the issue is `queued`, the retry uses a back-off, and the comment says that the reset time is unknown and the retry time is a back-off, not a prediction

#### Scenario: The back-off grows
- **WHEN** the reset time is unknown on the first, second and third retry
- **THEN** the waits are 30 minutes, 2 hours and 5 hours

### Requirement: A queued issue waits for its retry time
The planner SHALL NOT start a `queued` issue whose retry marker is in the future, and SHALL NOT take a free agent slot for it or post a comment about it. The queue and the decision of the `go` workflow SHALL both apply this. A marker counts only when it is in a comment of a bot.

#### Scenario: Before the time
- **WHEN** the queue is evaluated before the retry time of a queued issue
- **THEN** the issue stays queued, nothing is dispatched for it and no comment is posted

#### Scenario: A marker typed by a person
- **WHEN** a person writes a retry marker in a comment
- **THEN** it is ignored

#### Scenario: A person applies ready
- **WHEN** a person labels the held issue `ready` again
- **THEN** the issue is evaluated as any other, and the retries already made still count toward the bound

### Requirement: The retry loop is bounded
After 3 retries that again end at a usage limit, the issue SHALL go to `qa-failed` and the comment SHALL say that the retries stopped and ask a person. A marker older than 24 hours SHALL count as no retry. The bound SHALL count a retry whether or not its reset time was known.

#### Scenario: The limit is hit again and again
- **WHEN** the run of the third retry ends at a usage limit
- **THEN** the issue is `qa-failed`, the comment says it stopped after 3 retries and asks a person, and nothing is queued again

#### Scenario: An old episode
- **WHEN** the last retry marker is older than 24 hours
- **THEN** a new limit hit is the first retry of a new episode

### Requirement: Only one issue retries after a limit at a time
The planner SHALL start at most one issue that is retrying after a usage limit in an evaluation, and none while another issue that is retrying is `building`, so that the first retry shows whether the quota is back before the others start. The others SHALL stay queued with no comment, and the queue SHALL be evaluated when the retry ends.

#### Scenario: The window resets with three issues waiting
- **WHEN** three queued issues are all due and a slot is free
- **THEN** one starts and the other two stay queued until it ends

#### Scenario: The probe hits the limit again
- **WHEN** the one retry ends at a usage limit
- **THEN** the others are not started, and the issue is held again by its new marker

### Requirement: A retry never discards work
A run that ended at a usage limit SHALL return to the queue only when the work it did was kept on the branch of the issue or there was none. When the work could not be kept (a protected path, a restricted file, a marker or a credential was refused, the push failed, or the remote branch holds commits the run does not have), the issue SHALL go to `qa-failed` and the comment SHALL say what was not kept. A retry SHALL resume from the kept work and SHALL pass the same guards as any run.

#### Scenario: Work was kept
- **WHEN** the run was cut at a usage limit and its work was committed and pushed as work in progress
- **THEN** the issue is queued, the comment names the branch, and the next run resumes from it

#### Scenario: Work could not be kept
- **WHEN** the run was cut at a usage limit and the work was refused by a scan
- **THEN** the issue is `qa-failed` and the comment says the work was not kept and why

### Requirement: Queued issues start staggered
When the queue dispatches more than one build in an evaluation, it SHALL wait between one dispatch and the next (60 seconds, shorter when the whole dispatch would take more than 5 minutes) instead of dispatching all at once.

#### Scenario: A slot frees with several issues waiting
- **WHEN** the queue finds three issues that may start
- **THEN** it dispatches the first, waits, dispatches the second, waits and dispatches the third

### Requirement: Every text of the retry is in the catalog
The comments of the retry (when it will happen, that it stopped) and the quota phrases SHALL come from the message catalog, in English and Spanish, and a language that lacks one SHALL render it in English.

#### Scenario: Spanish repository
- **WHEN** `language` is `es` and a run stops at a usage limit
- **THEN** the comment is in Spanish, with the time in UTC and the labels unchanged

### Requirement: An issue returned to the queue ends with the queued label
When the final step returns an issue to the queue after a usage limit, the issue SHALL end with the `queued` label and with no other lifecycle label (`ready`, `building`, `qa-failed`). The result SHALL NOT depend on how the labels are edited: no single label edit adds and removes the same label.

#### Scenario: The issue was building
- **WHEN** a run ends at a usage limit that is retried and the issue was `building`
- **THEN** the issue has `queued` and none of `ready`, `building` or `qa-failed`, and the next queue pass can find it

#### Scenario: The labels were renamed
- **WHEN** the repository renamed its lifecycle labels in `relevo.yml` and a run ends at a usage limit that is retried
- **THEN** the issue ends with the renamed `queued` label and none of the other renamed lifecycle labels

#### Scenario: A label is never added and removed by one edit
- **WHEN** the label edits of the shipped workflow templates are read
- **THEN** no edit names the same label to add and to remove
