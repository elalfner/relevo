# Spec Delta

## ADDED Requirements

### Requirement: Skills are looked up in the folder of the platform first
`go` SHALL look for the folder of a listed skill under the folder of the platform of the issue, in `.claude/skills` and `.agents/skills`, before the same folders at the root of the repository. The skill SHALL meet every other condition of this specification wherever it is found.

#### Scenario: Skill in the folder of the platform
- **WHEN** the platform `app` has `path: app`, and `app/.claude/skills/flutter-add-widget-test` exists on the base branch
- **THEN** `go` gives `dev` the path of `app/.claude/skills/flutter-add-widget-test/SKILL.md`

#### Scenario: Skill at the root only
- **WHEN** the skill is under `.claude/skills` at the root and not in the folder of the platform
- **THEN** `go` gives the path at the root

#### Scenario: Another platform's skills
- **WHEN** the issue is for a platform whose stack has no such skill listed, and another platform's folder holds Flutter skills
- **THEN** `go` gives that agent none of the Flutter skills

### Requirement: The lock file next to the skills is the one checked
`doctor` SHALL compare each skill folder with its hash in the `skills-lock.json` that sits in the folder that holds the skills: the folder of the platform, or the root.

#### Scenario: Lock file in the folder of a platform
- **WHEN** `app/.claude/skills/dart-add-unit-test` differs from its hash in `app/skills-lock.json`
- **THEN** `doctor` warns and names the skill

#### Scenario: Skills at the root
- **WHEN** the skills are under the root and `skills-lock.json` is at the root
- **THEN** `doctor` compares them as before

### Requirement: A default skill that is not installed is a note
A skill listed by the plugin's profile, and not by the repository, that is not on the base branch SHALL be left out of the run with the reason "not on the base branch", and `doctor` SHALL report it once as a note with the command that installs it, never as a warning. A skill listed by the repository that is left out SHALL keep being reported as a warning.

#### Scenario: Default skill missing
- **WHEN** the plugin lists `dart-add-unit-test` for `dev` and it is not on the base branch
- **THEN** the resolution output has it left out with that reason, and `doctor` reports a note with its install command and no warning

#### Scenario: Skill the repository listed is missing
- **WHEN** the repository's profile lists a skill that is not on the base branch
- **THEN** `doctor` reports a warning for it, as before

#### Scenario: Default skill switched off
- **WHEN** the repository disables a default skill by name
- **THEN** the resolution output does not list it, and `doctor` reports no note and no warning for it
