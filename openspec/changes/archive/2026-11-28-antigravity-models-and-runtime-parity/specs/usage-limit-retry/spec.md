# Spec Delta

## MODIFIED Requirements

### Requirement: A run stopped by a usage limit returns to the queue with a retry time
When a cloud run ends because the usage limit, the quota, capacity, or the credit of the model account was reached — including Claude rate-limit/quota errors and Antigravity/Gemini errors (`exhausted your quota`, `MODEL_CAPACITY_EXHAUSTED`, `prepaid balance is insufficient`) in a failed result or guard summary — the final step SHALL return the issue to `queued` (not `build-failed`) and post one comment that says when it will retry. The comment SHALL carry a hidden marker with the retry time and the attempt number, and SHALL mention the assignee.

#### Scenario: The log names the reset
- **WHEN** a run ends at a usage limit and the rate-limit event of its log gives a reset time in the future
- **THEN** the issue is `queued`, not `build-failed`, and one comment says it will retry after that time, in UTC

#### Scenario: Antigravity quota or capacity failure
- **WHEN** an Antigravity `agent-guard.mjs` summary exits non-zero with `exhausted your quota`, `MODEL_CAPACITY_EXHAUSTED`, or `prepaid balance is insufficient` in its error or stderr tail
- **THEN** `reachedUsageLimit` returns `true` and `limit-retry.mjs` returns `action: "retry"` using the backoff schedule so the issue is requeued automatically

#### Scenario: The log does not name the reset
- **WHEN** a run ends at a usage limit and the log has no reset time, or one that is in the past or more than 8 days away
- **THEN** the issue is `queued`, the retry uses a back-off, and the comment says that the reset time is unknown and the retry time is a back-off, not a prediction

#### Scenario: The back-off grows
- **WHEN** the reset time is unknown on the first, second and third retry
- **THEN** the waits are 30 minutes, 2 hours and 5 hours
