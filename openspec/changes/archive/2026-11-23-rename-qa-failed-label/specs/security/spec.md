# Spec Delta

## MODIFIED Requirements

### Requirement: Cost control
Each run SHALL have turn and cost limits, and the daily digest SHALL include aggregate usage when available.

#### Scenario: Budget reached
- **WHEN** a run reaches its limit
- **THEN** it stops and the issue is labelled `build-failed` with the reason

### Requirement: The issue that is built is the issue that was approved
When the planner claims an issue it SHALL record a hash of the issue title and body in its decision, and `go` SHALL verify it before writing the specification. If it differs, the run SHALL end in `build-failed` with the reason "issue changed after ready" and push nothing. Line endings and trailing spaces SHALL NOT change the hash.

#### Scenario: Issue edited after ready
- **WHEN** the author edits the body of an issue after a maintainer applied `ready` and before `go` reads it
- **THEN** the hashes differ, nothing is built or pushed, and the issue is labelled `build-failed` with the reason "issue changed after ready"

#### Scenario: Issue unchanged
- **WHEN** the title and body are the same as when the issue was claimed
- **THEN** `go` continues

#### Scenario: Only whitespace differs
- **WHEN** the body differs from the claimed one only in line endings or trailing spaces
- **THEN** the hashes are equal and `go` continues

#### Scenario: Run started by hand
- **WHEN** someone runs `go` for an issue without a decision from the workflow
- **THEN** the same hash is computed when the issue is claimed and verified before the specification is written

### Requirement: Protected paths
A diff produced by the unattended agent SHALL NOT touch workflows (`.github/`), `relevo.yml`, `.relevo/` or the folders of skills. It SHALL touch dependency manifests and lock files only when the issue lists them in an `Allow-paths:` line. A violation SHALL end the run in `build-failed` with the reason "protected path in the diff", and nothing is pushed.

#### Scenario: Workflow edited
- **WHEN** the diff touches a file under `.github/`
- **THEN** the run ends in `build-failed` with the reason "protected path in the diff", even if the issue lists that path

#### Scenario: Lock file without permission
- **WHEN** the diff touches a dependency lock file and the issue has no `Allow-paths:` line naming it
- **THEN** the run ends in `build-failed` with the reason "protected path in the diff"

#### Scenario: Lock file with permission
- **WHEN** the issue says `Allow-paths: pubspec.yaml, pubspec.lock` and the diff touches only those protected files
- **THEN** the guard lets the diff pass

### Requirement: The profile of a repository cannot weaken the plugin's checks
`.relevo/` SHALL be a hard-protected path, and a profile of the repository SHALL only add to the plugin's profile, except that it MAY replace a key of its `review` block and MAY switch off a skill of the plugin by name with `skills.disable`. It SHALL NOT switch off a required skill, remove a tool or a generated-file pattern, or replace a command. A command can be replaced only through `relevo.yml`, which is also protected, so the checks that an unattended run must pass cannot be changed by the run.

#### Scenario: Run edits the profile
- **WHEN** a diff touches `.relevo/stacks/flutter.md`
- **THEN** the run ends in `build-failed` with the reason "protected path in the diff"

#### Scenario: Disable aimed at a check
- **WHEN** `skills.disable` names an entry that is not a skill of the plugin's lists
- **THEN** it changes nothing in the resolved profile, and no command, tool or required skill is removed

### Requirement: The skill folders of a platform are protected at any depth
The folders `.claude/skills/` and `.agents/`, and the file `skills-lock.json`, inside the folder of any platform declared in `relevo.yml` SHALL be hard-protected paths, as they are at the root. A skill that `go` hands to an agent SHALL NOT be changeable by the run that uses it, wherever it lives.

#### Scenario: Skill of a platform edited
- **WHEN** the platform `app` has `path: app` and a diff touches `app/.claude/skills/dart-add-unit-test/SKILL.md`
- **THEN** the run ends in `build-failed` with the reason "protected path in the diff", even if the issue lists that path in `Allow-paths:`

#### Scenario: Skill added to a platform
- **WHEN** a diff adds a folder under `app/.agents/skills/`
- **THEN** the run ends in `build-failed` with the reason "protected path in the diff", and the skill is not given to any agent

#### Scenario: Lock file of a platform edited
- **WHEN** the platform `app` has `path: app` and a diff touches `app/skills-lock.json`
- **THEN** the run ends in `build-failed` with the reason "protected path in the diff"

#### Scenario: Platform at the root
- **WHEN** a platform has `path: .`
- **THEN** only the root rules apply, and nothing else becomes protected

### Requirement: A restricted file in the output of a run fails the run
A restricted file that appears in the diff of an unattended run, or in the text a script of Relevo is about to publish, SHALL end the run in `build-failed` with the reason "restricted file in the diff", and nothing is pushed. A restricted file that is versioned in the repository SHALL fail in the same way.

#### Scenario: A restricted file in the diff
- **WHEN** the diff of a run adds `config/private.pem`, which is on the list
- **THEN** the run ends in `build-failed` with the reason "restricted file in the diff", naming the path, and nothing is pushed

#### Scenario: A restricted file that is already versioned
- **WHEN** the base branch contains a versioned `.env`
- **THEN** the run ends in `build-failed` with the same reason instead of building around it
