## ADDED Requirements

### Requirement: The run comment shows the seconds of each check
When the receipt of the validation gate exists in the working folder, the usage comment SHALL list each check with its seconds, marking those that were reused, and the hidden marker SHALL carry the same figures. When there is no readable receipt, nothing is added.

#### Scenario: A run ends
- **WHEN** a run ends and the gate wrote a receipt
- **THEN** the comment shows the seconds per check, with "reused" where the gate did not run it

#### Scenario: No receipt
- **WHEN** the run ended before the gate
- **THEN** the comment is as it was
