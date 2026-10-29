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
