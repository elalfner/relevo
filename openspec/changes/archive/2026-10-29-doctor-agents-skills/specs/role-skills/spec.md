# Spec Delta

## MODIFIED Requirements

### Requirement: A default skill that is not installed is a note
A skill listed by the plugin's profile, and not by the repository, that is not on the base branch SHALL be left out of the run with the reason "not on the base branch", and `doctor` SHALL report it once as a note with the command that installs it, never as a warning. For a stack whose recommended skills `doctor` already reports in a note of the stack, that note names the missing skills and `doctor` SHALL NOT report them a second time. A skill listed by the repository that is left out SHALL keep being reported as a warning.

#### Scenario: Default skill missing
- **WHEN** the plugin lists `dart-add-unit-test` for `dev` of a Flutter platform and it is not on the base branch
- **THEN** the resolution output has it left out with that reason, `doctor` reports no warning, and the note `recommended.flutter.claude` names the skill with its install command

#### Scenario: One note for a monorepo
- **WHEN** the Flutter platform is in `app/`, and neither skill of the default set is on the base branch
- **THEN** `doctor` reports one note for the stack that names both skills, and no note for each skill

#### Scenario: Stack with no note of its own
- **WHEN** the plugin lists a skill for a stack that has no note of recommended skills, and it is not on the base branch
- **THEN** `doctor` reports one note for that skill with its install command, and no warning

#### Scenario: Skill the repository listed is missing
- **WHEN** the repository's profile lists a skill that is not on the base branch
- **THEN** `doctor` reports a warning for it, as before

#### Scenario: Default skill switched off
- **WHEN** the repository disables a default skill by name
- **THEN** the resolution output does not list it, and `doctor` reports no note and no warning for it
