# Spec Delta

## MODIFIED Requirements

### Requirement: The profile of a repository cannot weaken the plugin's checks
`.relevo/` SHALL be a hard-protected path, and a profile of the repository SHALL only add to the plugin's profile, except that it MAY replace a key of its `review` block and MAY switch off a skill of the plugin by name with `skills.disable`. It SHALL NOT switch off a required skill, remove a tool or a generated-file pattern, or replace a command. A command can be replaced only through `relevo.yml`, which is also protected, so the checks that an unattended run must pass cannot be changed by the run.

#### Scenario: Run edits the profile
- **WHEN** a diff touches `.relevo/stacks/flutter.md`
- **THEN** the run ends in `qa-failed` with the reason "protected path in the diff"

#### Scenario: Disable aimed at a check
- **WHEN** `skills.disable` names an entry that is not a skill of the plugin's lists
- **THEN** it changes nothing in the resolved profile, and no command, tool or required skill is removed

## ADDED Requirements

### Requirement: The skill folders of a platform are protected at any depth
The folders `.claude/skills/` and `.agents/`, and the file `skills-lock.json`, inside the folder of any platform declared in `relevo.yml` SHALL be hard-protected paths, as they are at the root. A skill that `go` hands to an agent SHALL NOT be changeable by the run that uses it, wherever it lives.

#### Scenario: Skill of a platform edited
- **WHEN** the platform `app` has `path: app` and a diff touches `app/.claude/skills/dart-add-unit-test/SKILL.md`
- **THEN** the run ends in `qa-failed` with the reason "protected path in the diff", even if the issue lists that path in `Allow-paths:`

#### Scenario: Skill added to a platform
- **WHEN** a diff adds a folder under `app/.agents/skills/`
- **THEN** the run ends in `qa-failed` with the reason "protected path in the diff", and the skill is not given to any agent

#### Scenario: Lock file of a platform edited
- **WHEN** the platform `app` has `path: app` and a diff touches `app/skills-lock.json`
- **THEN** the run ends in `qa-failed` with the reason "protected path in the diff"

#### Scenario: Platform at the root
- **WHEN** a platform has `path: .`
- **THEN** only the root rules apply, and nothing else becomes protected
