## ADDED Requirements

### Requirement: Issue asks the questions of the stack
When the issue is for a platform, `issue` SHALL resolve the questions of its stack with the profile command and ask those that the idea does not already answer, together with the other missing information, without asking again what is answered.

#### Scenario: Laravel issue
- **WHEN** the issue is for a platform of stack `laravel`
- **THEN** `issue` asks the questions of that profile (for example the shape of error responses and who is authorised) that the idea leaves open

#### Scenario: Already answered
- **WHEN** the idea says who is authorised
- **THEN** that question is not asked again
