# Spec Delta

## ADDED Requirements

### Requirement: A skill used only when installed leaves no trace when absent
A skill that a profile lists under `skills_when_installed` and whose folder is not on the base branch SHALL be left out of the resolution output, and `doctor` SHALL report nothing for it, neither a note nor a warning. One that is on the base branch SHALL meet every other condition of this specification and be marked as a default skill. Its bytes SHALL count in the size budget of the role.

#### Scenario: Absent
- **WHEN** the plugin lists `laravel-best-practices` under `skills_when_installed` and it is not on the base branch
- **THEN** the resolution output has no entry for it and `doctor` reports nothing about it

#### Scenario: Present
- **WHEN** the folder is on the base branch, in the folder of the platform or at the root
- **THEN** the resolution output gives the path of its `SKILL.md`, marked as a default skill

#### Scenario: Present with scripts
- **WHEN** the folder holds a script and `skills.allow_scripts` does not name the skill
- **THEN** it is left out with the reason "has scripts and is not allowed", and `doctor` reports it as it does for any skill that is left out for that reason

#### Scenario: Size
- **WHEN** the skills of a role that are present add up to more than 20 KB
- **THEN** `doctor` warns, as for any skills of a role
