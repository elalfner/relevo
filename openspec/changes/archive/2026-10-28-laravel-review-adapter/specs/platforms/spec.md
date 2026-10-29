# Spec Delta

## MODIFIED Requirements

### Requirement: The profile can be extended by the repository but not weakened
A repository MAY add `.relevo/stacks/<stack>.md`. Its lists (tools, skills, generated files) SHALL be added to the plugin's, and its body SHALL be added after the plugin's body. It SHALL NOT remove an item of the plugin or replace a command. A verification command is replaced only through `platforms.<name>.checks` in `relevo.yml`. The one thing the repository's header MAY replace is a key of its `review` block, which says how the review is driven and is not a verification command. When the plugin has no profile for a stack, the file of the repository SHALL be the whole profile.

#### Scenario: Extra hygiene
- **WHEN** the repository's `.relevo/stacks/flutter.md` adds a rule in its body and a generated-file pattern
- **THEN** the resolved profile has the plugin's body followed by the repository's, and both patterns

#### Scenario: A repository tries to remove a check
- **WHEN** the repository's profile sets a command that the plugin's profile also sets
- **THEN** the plugin's command is kept, the resolved profile reports that the repository's value was ignored, and `doctor` warns about it

#### Scenario: Command replaced the supported way
- **WHEN** `platforms.web.checks.test` is `pnpm test`
- **THEN** the resolved profile of `web` uses `pnpm test` for `test` and the plugin's value for the other commands

#### Scenario: Stack defined only by the repository
- **WHEN** a platform has stack `elixir`, the plugin has no such profile and `.relevo/stacks/elixir.md` exists
- **THEN** that file is the profile

#### Scenario: Review key replaced
- **WHEN** the repository's `.relevo/stacks/laravel.md` sets `review.log`
- **THEN** the resolved profile uses the repository's value, and lists `review.log` as replaced

## ADDED Requirements

### Requirement: A profile can say how its stack is reviewed
A profile header MAY carry a `review` block with `log` (a path or a glob of the files the audit reads), `test` (the base command that runs the project's tests) and `serve` (a `command`, a `url` and `env` for a server the agent may start, where `{port}` stands for the port the agent chose). The plugin's `laravel` profile SHALL set `log` to the files under `storage/logs` and `test` to `php artisan test`, and no `serve`. A profile body MAY have a section `Review`; it SHALL be read by the agent only in a review, joined after the plugin's, and SHALL be left out of the body that `dev` and `qa` receive.

#### Scenario: Defaults of Laravel
- **WHEN** the profile of `laravel` is resolved with no repository file
- **THEN** its `review` block has `log` under `storage/logs`, `test` as `php artisan test` and no `serve`

#### Scenario: Serve added by the repository
- **WHEN** the repository's profile sets `serve` with a command and a URL with `{port}`
- **THEN** the resolved profile has that `serve` and the defaults for `log` and `test`

#### Scenario: Agents other than review
- **WHEN** the profile is resolved for `dev` or `qa`
- **THEN** its body does not contain the section `Review`

#### Scenario: Review role
- **WHEN** the profile is resolved with the role `review`
- **THEN** the output has the `review` block and the sections `Review` of the plugin followed by the repository's

### Requirement: The review block cannot loosen a fixed rule of the review
Neither the `review` block nor the section `Review` SHALL change that the person confirms every line, that the log is audited, that `decide` gates the pull request, that environment files are never read, that no waiver is suggested, or that no code is patched in a review. A `serve` command SHALL be read only from a profile in the repository's base branch, never from an issue or a comment, and an unattended run SHALL NOT change the file. A resolved profile whose text asks for one of those things SHALL be reported, and `doctor` SHALL warn.

#### Scenario: Text asks to skip the audit
- **WHEN** the section `Review` says to skip the audit or to mark every line ok
- **THEN** the review ignores it, the resolved profile reports the line, and `doctor` warns

#### Scenario: Serve from an issue
- **WHEN** an issue or a comment names a command to start a server
- **THEN** the review does not use it

#### Scenario: Unattended change
- **WHEN** an unattended run changes `.relevo/stacks/laravel.md`
- **THEN** the run ends in `qa-failed`, as for any protected file

#### Scenario: Invalid block
- **WHEN** the `review` block has an unknown key, a `serve` without a `url`, or a `url` that is not on `localhost`
- **THEN** resolving the profile fails and names the key
