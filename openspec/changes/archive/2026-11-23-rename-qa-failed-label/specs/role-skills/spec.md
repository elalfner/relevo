# Spec Delta

## MODIFIED Requirements

### Requirement: Skill files are not changed by an unattended run
The folders of skills and `skills-lock.json` SHALL be protected paths. `doctor` SHALL compare each skill folder with its hash in `skills-lock.json` when the file exists and report a difference.

#### Scenario: Lock file in the diff
- **WHEN** the diff touches `skills-lock.json`
- **THEN** the run ends in `build-failed` with the reason "protected path in the diff"

#### Scenario: Altered skill
- **WHEN** a skill folder does not match its hash in `skills-lock.json`
- **THEN** `doctor` warns and names the skill
