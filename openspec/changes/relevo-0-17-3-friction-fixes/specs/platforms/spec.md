## ADDED Requirements

### Requirement: An ignored command is reported as a warning without running doctor
When the resolved profile ignores a command of the repository's profile, `stack-profile.mjs` SHALL list it in a `warnings` entry of its output that gives the key, the value the repository asked for, the value the plugin keeps and `platforms.<name>.checks` of `relevo.yml` as the way to replace it. The `ignored` list SHALL stay as it is. A profile that ignores nothing SHALL have an empty `warnings`. The documentation of the profile SHALL state that a repository profile cannot replace a command of the plugin's profile and that `platforms.<name>.checks` does.

#### Scenario: The repository tries to replace test
- **WHEN** `.relevo/stacks/nhost.md` sets `commands.test` to `npm run --silent test:core` and the plugin's profile sets `npm run --silent test`
- **THEN** the output keeps `npm run --silent test` in `commands`, keeps the entry in `ignored`, and has a warning that names both values and `platforms.<name>.checks`

#### Scenario: A command that only the repository defines
- **WHEN** the repository's profile defines a command the plugin's does not
- **THEN** it is used and there is no warning

#### Scenario: Nothing ignored
- **WHEN** the repository has no profile or it differs from the plugin's in nothing that is ignored
- **THEN** `warnings` is empty
