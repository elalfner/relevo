# Spec Delta

## ADDED Requirements

### Requirement: The digest says what QA stopped
When runs of the last seven days left a QA record, the digest SHALL have one line with the runs recorded, the runs in which QA stopped something and the corrections of `fix` that were defects. With no record it SHALL have no such line.

#### Scenario: A week with records
- **WHEN** four runs left a record, QA stopped something in two and one correction was a defect
- **THEN** the digest says four runs, two stopped by QA and one defect corrected by a person

#### Scenario: A week without records
- **WHEN** no run left a record
- **THEN** the digest has no line about QA
