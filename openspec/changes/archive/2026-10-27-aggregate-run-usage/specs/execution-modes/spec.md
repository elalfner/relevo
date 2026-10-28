## MODIFIED Requirements

### Requirement: The consumption of a run is visible
After a cloud run, a comment on the issue SHALL give the number of turns, the cost and the tokens that the execution log reports, and say that the cost is notional when the mode is a subscription. The comment SHALL also carry a hidden, machine-readable marker with those figures and whether the cost is notional, so that they can be added up without reading the sentence. When the log reports none of them, nothing SHALL be posted.

#### Scenario: Log with usage
- **WHEN** the execution log has a result with turns, cost and token counts
- **THEN** one comment states them and carries the marker with the same figures

#### Scenario: Log with partial usage
- **WHEN** the execution log reports the turns but not the cost
- **THEN** the sentence and the marker both give the turns and leave the cost out

#### Scenario: Log without usage
- **WHEN** the execution log is missing or has no result
- **THEN** no comment is posted and the run is not reported as failed
