## ADDED Requirements

### Requirement: Platform settings
`relevo.yml` SHALL support `platforms` (see the `platforms` capability), `platforms.<name>.checks` (a map from a verification command of the stack's profile to the command this repository uses instead) and `skills.allow_scripts` (a list of skill names). `platform` SHALL stay supported as a shortcut and SHALL be replaced in the validated configuration by the equivalent `platforms` entry.

#### Scenario: Checks override
- **WHEN** `platforms.web.checks.test` is `pnpm test`
- **THEN** validation passes and `pnpm test` is the test command of `web`

#### Scenario: Unknown check
- **WHEN** a `checks` key is not a command of the stack's profile
- **THEN** validation fails and lists the commands the profile defines

#### Scenario: Validated configuration
- **WHEN** a configuration with the legacy `platform: flutter-android` is validated
- **THEN** the result has `platforms` with one entry and the commands read `platforms`, never `platform`

## MODIFIED Requirements

### Requirement: Repository and team settings
`relevo.yml` SHALL support `branches.base`, `branches.release`, `tracker`, `git_provider`, `platform` (legacy shortcut) or `platforms`, `team.members`, `team.spec_writer` and `team.approvers` (used by `roles`).

#### Scenario: Team and branches set
- **WHEN** `relevo.yml` sets `branches.base`, `team.members` and `team.spec_writer`
- **THEN** validation passes and the commands use those values

#### Scenario: No platform set
- **WHEN** neither `platform` nor `platforms` is set
- **THEN** the default is the legacy `platform: flutter-android`

### Requirement: Project rules are referenced, not copied
When `qa.rules_from` names a file, or a list of files, the QA agent SHALL read each of them at each run and treat their rules as binding. Every listed file SHALL be a protected path.

#### Scenario: Rules change
- **WHEN** the referenced rules file changes between two runs
- **THEN** the second run applies the new rules without any change to the agents

#### Scenario: Several rules files
- **WHEN** `qa.rules_from` is `[CLAUDE.md, .ai/rules/backend.md]`
- **THEN** QA reads both, and a diff that touches either is refused as a protected path

#### Scenario: Missing file in the list
- **WHEN** a listed file does not exist
- **THEN** `doctor` warns and names it
