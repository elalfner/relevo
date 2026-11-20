## ADDED Requirements

### Requirement: A red gate names the command the repository profile could not replace
When the gate is `red` and the resolved profile of the platform ignored a command of the repository's profile (a `commands.<name>` that differs from the plugin's), the gate SHALL say, with the red result, which command ran, which value the repository's profile asked for, and that `platforms.<name>.checks` of `relevo.yml` is the way to replace it. The statement SHALL come only with a red result, and only for a command that was ignored and failed. A green result, a `could-not-run` result and the exit codes SHALL NOT change.

#### Scenario: The ignored command is the one that failed
- **WHEN** the repository's profile sets `commands.test` to `npm run --silent test:core`, the plugin keeps `npm run --silent test`, and that command fails
- **THEN** the gate reports `red`, names `npm run --silent test`, and says that the profile asked for `npm run --silent test:core`, that it was ignored, and that `platforms.<name>.checks.test` in `relevo.yml` replaces it

#### Scenario: Nothing was ignored
- **WHEN** the profile ignored no command and a test fails
- **THEN** the output is the one it always was

#### Scenario: A command that was not ignored fails
- **WHEN** the profile ignored `commands.test` but `analyze` is the command that fails
- **THEN** the output names `analyze` as failed and does not mention the ignored `test`
