# configuration Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: Per-repository configuration file
Relevo SHALL read its behaviour from a `relevo.yml` file at the repository root. Skills SHALL NOT hard-code values that the file defines.

#### Scenario: Skill reads configuration
- **WHEN** any Relevo command starts in a repository that has `relevo.yml`
- **THEN** it loads the file and uses its values for branches, review mode, limits, evidence policy, labels and language

#### Scenario: Missing configuration
- **WHEN** a Relevo command other than `init` starts and `relevo.yml` does not exist
- **THEN** it stops and tells the user to run `/relevo:init`

### Requirement: Repository and team settings
`relevo.yml` SHALL support `branches.base`, `branches.release`, `tracker`, `git_provider`, `platform` (legacy shortcut) or `platforms`, `team.members`, `team.spec_writer` and `team.approvers` (used by `roles`).

#### Scenario: Team and branches set
- **WHEN** `relevo.yml` sets `branches.base`, `team.members` and `team.spec_writer`
- **THEN** validation passes and the commands use those values

#### Scenario: No platform set
- **WHEN** neither `platform` nor `platforms` is set
- **THEN** the default is the legacy `platform: flutter-android`

### Requirement: Review and limit settings
`relevo.yml` SHALL support `review.mode` (`none`, `peer`, `roles`), `review.merger` (`author`, `approver`), `review.ship_without_ci` (`true`, `false`), `limits.built_unreviewed_per_person`, `limits.concurrent_agents`, `limits.review_sla_hours`, `limits.run_max_turns` and `limits.run_max_cost`.

#### Scenario: Review mode set
- **WHEN** `review.mode` is `peer` and `review.merger` is `approver`
- **THEN** validation passes and `ship` applies the peer rules

#### Scenario: Unattended ships without CI
- **WHEN** `review.ship_without_ci` is absent
- **THEN** it is `false`, and an unattended ship stops when there are no checks

#### Scenario: Invalid ship setting
- **WHEN** `review.ship_without_ci` is `yes`
- **THEN** validation fails and names the setting and the allowed values `true` and `false`

### Requirement: Quality and presentation settings
`relevo.yml` SHALL support `qa.retries`, `qa.rules_from`, `evidence.policy` (`attach_to_pr`, `local_only`), `labels`, `language` and `trust` (`private-team`, `public`).

#### Scenario: Evidence kept local
- **WHEN** `evidence.policy` is `local_only`
- **THEN** validation passes and captures are not attached to pull requests

### Requirement: Defaults and validation
Optional settings SHALL have documented defaults, `limits.run_max_cost` SHALL be mandatory, and invalid values SHALL be rejected with an actionable message.

#### Scenario: Defaults
- **WHEN** an optional setting is absent
- **THEN** the documented default is used: base `dev`, release `main`, `review.mode` `peer`, `review.merger` `approver`, `built_unreviewed_per_person` 2, `concurrent_agents` 3, `review_sla_hours` 8, `run_max_turns` 100, `qa.retries` 1, `evidence.policy` `attach_to_pr`, `language` `en`, `trust` `private-team`

#### Scenario: Cost limit is mandatory
- **WHEN** `limits.run_max_cost` is absent
- **THEN** validation fails and unattended runs do not start, because an unattended agent must always have a cost limit

#### Scenario: Invalid value
- **WHEN** a setting has a value outside its allowed set
- **THEN** validation fails and names the setting, the value and the allowed values

### Requirement: Message language
When `language` is set, hand-off messages, digests and prompts SHALL be produced in that language. Label names are unaffected by `language` and are changed only through `labels`.

#### Scenario: Spanish messages
- **WHEN** `language` is `es`
- **THEN** hand-off messages are written in Spanish while label names stay as configured

### Requirement: Secrets never live in configuration
`relevo.yml` SHALL NOT contain API keys or tokens. Credentials SHALL come from the repository's secret store.

#### Scenario: Secret detected in configuration
- **WHEN** validation finds a value that looks like a credential in `relevo.yml`
- **THEN** it fails and tells the user to move the value to the secret store

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

### Requirement: Linked repositories setting
`relevo.yml` SHALL support `links`, a list of `owner/repo` names (default: empty). A malformed name or a repeated one SHALL fail validation naming the entry.

#### Scenario: Valid list
- **WHEN** `links` is `[acme/api, acme/design]`
- **THEN** validation passes and both are linked

#### Scenario: Malformed name
- **WHEN** `links` contains `acme` or `acme/api/extra`
- **THEN** validation fails and says the form is `owner/repo`

#### Scenario: Repeated name
- **WHEN** `links` lists `acme/api` twice
- **THEN** validation fails naming `acme/api`

### Requirement: Alert for a build that stopped reporting
`relevo.yml` SHALL support `limits.building_alert_hours`, a positive integer (default 3): the hours without activity after which an issue on `building` is reported as stuck.

#### Scenario: Default
- **WHEN** the setting is absent
- **THEN** its value is 3

#### Scenario: Invalid
- **WHEN** it is 0 or not a whole number
- **THEN** validation fails naming the setting

### Requirement: Autopilot settings
`relevo.yml` SHALL accept `review.autopilot` with the values `off`, `precheck` and `verify` (default `off`), and `review.allowed_origins`, a list of web origins (default empty) that a driven review may visit besides `localhost`. An unknown value SHALL fail validation naming the setting.

#### Scenario: Default
- **WHEN** the file does not set them
- **THEN** `review.autopilot` is `off` and `review.allowed_origins` is empty

#### Scenario: Invalid value
- **WHEN** `review.autopilot` is `always`
- **THEN** validation fails and names `review.autopilot` and the allowed values

#### Scenario: Origins
- **WHEN** `review.allowed_origins` lists `https://staging.example.com`
- **THEN** a driven review may load that origin

### Requirement: Design images setting
`relevo.yml` SHALL accept `design.images`, a boolean that defaults to `false`: pasted attachments are downloaded and shown to the model only when it is `true`. Files that are already in the repository do not depend on it.

#### Scenario: Default
- **WHEN** the file does not set it
- **THEN** `design.images` is `false`

#### Scenario: Invalid value
- **WHEN** `design.images` is `sometimes`
- **THEN** validation fails and names the setting

### Requirement: Runner setting
`relevo.yml` SHALL support `runner.labels`, a non-empty list of strings naming the runner that every Relevo workflow runs on. When it is absent the runner SHALL be `ubuntu-latest`. Validation SHALL reject an empty list, an entry that is not a non-empty string, and a value that is not a list.

#### Scenario: Default runner
- **WHEN** `relevo.yml` has no `runner` key
- **THEN** validation passes and the runner is `ubuntu-latest`

#### Scenario: Self-hosted runner with labels
- **WHEN** `runner.labels` is `[self-hosted, linux-build]`
- **THEN** validation passes and the workflows run on a runner that has both labels

#### Scenario: Empty list
- **WHEN** `runner.labels` is `[]`
- **THEN** validation fails and says the list needs at least one label

#### Scenario: A single string
- **WHEN** `runner.labels` is `self-hosted`
- **THEN** validation fails and says it must be a list of labels

### Requirement: The runner setting holds no persistence flag
`relevo.yml` SHALL NOT define a setting that declares a runner ephemeral or persistent. Relevo SHALL treat every runner as one that may persist between jobs.

#### Scenario: A persistence key
- **WHEN** `relevo.yml` sets `runner.ephemeral`
- **THEN** validation fails and says that the key does not exist and that Relevo assumes a runner persists

### Requirement: Restricted paths setting
`relevo.yml` SHALL accept `restricted_paths`, a list of paths or globs that is empty by default. Its entries are added to the base list of restricted files and can never remove one. A path in the list SHALL be relative to the repository, and an absolute path or a path that leaves the repository SHALL be rejected.

#### Scenario: Default
- **WHEN** the file does not set it
- **THEN** only the base list applies

#### Scenario: A project adds its own
- **WHEN** `restricted_paths` lists `infra/prod.tfvars`
- **THEN** that file is restricted in addition to the base list

#### Scenario: A project tries to lift a base entry
- **WHEN** `restricted_paths` or a profile of the repository names `.env` in a way that would allow it
- **THEN** `.env` stays restricted and validation reports that the base list cannot be reduced

#### Scenario: Invalid value
- **WHEN** an entry is `/etc/passwd` or `../outside`
- **THEN** validation fails and names the setting and the entry
