## MODIFIED Requirements

### Requirement: A usage limit is reported as a usage limit
When a cloud run ends because the usage limit, the quota or the credit was reached, the final step SHALL say so and say when the issue will retry (see the capability `usage-limit-retry`), instead of the generic "ended without a result" and instead of telling a person to apply `ready` again later. When the retry is not possible (the retries are used up or the work could not be kept) it SHALL say so and ask a person.

#### Scenario: Limit reached
- **WHEN** the execution log of the failed run shows that a usage limit was reached: its final result is an error whose text says so, or a rate-limit event has a status other than `allowed`
- **THEN** the issue returns to the queue with a retry time, is not marked `qa-failed`, and the comment says the usage limit was reached and when it will retry

#### Scenario: Retries used up
- **WHEN** the run of the third retry ends at a usage limit
- **THEN** the issue is marked `qa-failed` and the comment says the usage limit was reached again and asks a person

#### Scenario: Another failure
- **WHEN** the run failed for any other reason, including a log whose rate-limit events all report `allowed`
- **THEN** the comment is the generic one with the link to the run

## ADDED Requirements

### Requirement: The usage comment shows the quota window and its utilisation
When the execution log carries rate-limit events with a window and a utilisation, the usage comment SHALL say, for each window, the utilisation at the start and at the end of the run, and the reset time when the log has it; the hidden marker SHALL carry the same under `quota`. When the log has none (an API-key repository has no weekly window), no quota phrase and no `quota` key SHALL be written, and nothing SHALL be estimated.

#### Scenario: Subscription run
- **WHEN** the log has rate-limit events for the 5-hour and the weekly window
- **THEN** the comment says each window went from its first utilisation to its last

#### Scenario: API-key repository
- **WHEN** the log has no rate-limit events with a window
- **THEN** the comment is as it was, with no quota line

#### Scenario: A malformed figure
- **WHEN** an event has a utilisation that is not a number between 0 and 1
- **THEN** that figure is left out and the others are shown
