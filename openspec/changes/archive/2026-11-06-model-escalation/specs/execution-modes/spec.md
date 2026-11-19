## ADDED Requirements

### Requirement: The comment says when the developer went up
When the developer ran a retry on a model higher than the one of the attempt before, the usage comment SHALL say, for each step, the models, the attempt and whether the gate was red or QA rejected, and the usage marker SHALL carry the same steps under `escalated`. A run with no step SHALL give the comment and the marker it gave before.

#### Scenario: A retry went up
- **WHEN** the developer ran on `haiku` and the retry on `sonnet` after a QA rejection
- **THEN** the comment says "The developer went up on a retry: haiku to sonnet on attempt 2 (QA rejected)" and the marker carries `escalated`

#### Scenario: No retry went up
- **WHEN** no retry ran or none changed the model
- **THEN** the comment and the marker have no mention of it
