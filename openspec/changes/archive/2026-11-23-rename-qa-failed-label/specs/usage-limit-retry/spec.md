# Spec Delta

## MODIFIED Requirements

### Requirement: A run stopped by a usage limit returns to the queue with a retry time
When a cloud run ends because the usage limit, the quota or the credit of the model account was reached, the final step SHALL return the issue to `queued` (not `build-failed`) and post one comment that says when it will retry. The comment SHALL carry a hidden marker with the retry time and the attempt number, and SHALL mention the assignee.

#### Scenario: The log names the reset
- **WHEN** a run ends at a usage limit and the rate-limit event of its log gives a reset time in the future
- **THEN** the issue is `queued`, not `build-failed`, and one comment says it will retry after that time, in UTC

#### Scenario: The log does not name the reset
- **WHEN** a run ends at a usage limit and the log has no reset time, or one that is in the past or more than 8 days away
- **THEN** the issue is `queued`, the retry uses a back-off, and the comment says that the reset time is unknown and the retry time is a back-off, not a prediction

#### Scenario: The back-off grows
- **WHEN** the reset time is unknown on the first, second and third retry
- **THEN** the waits are 30 minutes, 2 hours and 5 hours

### Requirement: The retry loop is bounded
After 3 retries that again end at a usage limit, the issue SHALL go to `build-failed` and the comment SHALL say that the retries stopped and ask a person. A marker older than 24 hours SHALL count as no retry. The bound SHALL count a retry whether or not its reset time was known.

#### Scenario: The limit is hit again and again
- **WHEN** the run of the third retry ends at a usage limit
- **THEN** the issue is `build-failed`, the comment says it stopped after 3 retries and asks a person, and nothing is queued again

#### Scenario: An old episode
- **WHEN** the last retry marker is older than 24 hours
- **THEN** a new limit hit is the first retry of a new episode

### Requirement: A retry never discards work
A run that ended at a usage limit SHALL return to the queue only when the work it did was kept on the branch of the issue or there was none. When the work could not be kept (a protected path, a restricted file, a marker or a credential was refused, the push failed, or the remote branch holds commits the run does not have), the issue SHALL go to `build-failed` and the comment SHALL say what was not kept. A retry SHALL resume from the kept work and SHALL pass the same guards as any run.

#### Scenario: Work was kept
- **WHEN** the run was cut at a usage limit and its work was committed and pushed as work in progress
- **THEN** the issue is queued, the comment names the branch, and the next run resumes from it

#### Scenario: Work could not be kept
- **WHEN** the run was cut at a usage limit and the work was refused by a scan
- **THEN** the issue is `build-failed` and the comment says the work was not kept and why

### Requirement: An issue returned to the queue ends with the queued label
When the final step returns an issue to the queue after a usage limit, the issue SHALL end with the `queued` label and with no other lifecycle label (`ready`, `building`, `build-failed`). The result SHALL NOT depend on how the labels are edited: no single label edit adds and removes the same label.

#### Scenario: The issue was building
- **WHEN** a run ends at a usage limit that is retried and the issue was `building`
- **THEN** the issue has `queued` and none of `ready`, `building` or `build-failed`, and the next queue pass can find it

#### Scenario: The labels were renamed
- **WHEN** the repository renamed its lifecycle labels in `relevo.yml` and a run ends at a usage limit that is retried
- **THEN** the issue ends with the renamed `queued` label and none of the other renamed lifecycle labels

#### Scenario: A label is never added and removed by one edit
- **WHEN** the label edits of the shipped workflow templates are read
- **THEN** no edit names the same label to add and to remove
