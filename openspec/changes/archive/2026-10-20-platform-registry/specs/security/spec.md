## ADDED Requirements

### Requirement: Skills come from the base branch and cannot be changed by a run
A skill given to an agent SHALL be one that exists on the base branch. The folders of skills and `skills-lock.json` SHALL be hard-protected paths, so an unattended run cannot change a skill it will later trust. A skill with scripts SHALL be used only when `skills.allow_scripts` names it.

#### Scenario: Skill created by the branch
- **WHEN** a run adds a skill folder
- **THEN** the commit is refused as a protected path, and the skill is not given to any agent

#### Scenario: Script of a skill
- **WHEN** a skill contains a script and the repository does not allow it
- **THEN** the skill is not given to any agent

### Requirement: The profile of a repository cannot weaken the plugin's checks
`.relevo/` SHALL be a hard-protected path, and a profile of the repository SHALL only add to the plugin's profile. A command can be replaced only through `relevo.yml`, which is also protected, so the checks that an unattended run must pass cannot be changed by the run.

#### Scenario: Run edits the profile
- **WHEN** a diff touches `.relevo/stacks/flutter.md`
- **THEN** the run ends in `qa-failed` with the reason "protected path in the diff"
