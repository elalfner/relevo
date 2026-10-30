# role-skills Specification

## Purpose
TBD - created by archiving change platform-registry. Update Purpose after archive.

## Requirements

### Requirement: Extra skills per role
A profile MAY list extra skills for the roles `dev`, `qa`, `issue` and `review`; `fix` SHALL use those of `dev` and `qa`. `go` SHALL resolve them to the paths of their `SKILL.md` files and give those paths to the agent of the role. The agent SHALL read only the parts of a skill that apply to its task. Relevo's own rules and the project rules file SHALL take precedence over any skill.

#### Scenario: Skill for the developer
- **WHEN** the resolved profile lists `laravel-best-practices` for `dev` and the skill is available
- **THEN** `go` gives `dev` the path of its `SKILL.md`

#### Scenario: Skill and rules disagree
- **WHEN** a skill recommends something a project rule forbids
- **THEN** the agent follows the project rule

### Requirement: Only trustworthy skills are used
A skill SHALL be used only when its folder exists on the base branch (not only in the working tree of the run), its frontmatter does not set `disable-model-invocation`, and it contains no executable files unless `skills.allow_scripts` in `relevo.yml` names it. A skill that fails these conditions SHALL be left out, and the resolution output SHALL say which skill was left out and why.

#### Scenario: Skill added by the branch
- **WHEN** a skill exists in the working tree of the run but not on the base branch
- **THEN** it is left out with the reason "not on the base branch"

#### Scenario: Skill reserved for the person
- **WHEN** a listed skill sets `disable-model-invocation: true`
- **THEN** it is left out with the reason "reserved for the person"

#### Scenario: Skill with scripts
- **WHEN** a skill folder contains a script and `skills.allow_scripts` does not name the skill
- **THEN** it is left out with the reason "has scripts and is not allowed"

#### Scenario: Skill with scripts that the repository allows
- **WHEN** `skills.allow_scripts` names the skill
- **THEN** it is used and `doctor` lists it as a skill with scripts that is allowed

### Requirement: Skill files are not changed by an unattended run
The folders of skills and `skills-lock.json` SHALL be protected paths. `doctor` SHALL compare each skill folder with its hash in `skills-lock.json` when the file exists and report a difference.

#### Scenario: Lock file in the diff
- **WHEN** the diff touches `skills-lock.json`
- **THEN** the run ends in `qa-failed` with the reason "protected path in the diff"

#### Scenario: Altered skill
- **WHEN** a skill folder does not match its hash in `skills-lock.json`
- **THEN** `doctor` warns and names the skill

### Requirement: Skills have a size budget
`doctor` SHALL warn when the `SKILL.md` files resolved for one role together exceed 20 KB, because every byte is read by the agent at each run.

#### Scenario: Large skill set
- **WHEN** the skills of `dev` add up to 30 KB
- **THEN** `doctor` warns, names the role and the size

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
