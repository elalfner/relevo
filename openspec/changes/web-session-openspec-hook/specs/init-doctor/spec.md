# Spec Delta

## ADDED Requirements

### Requirement: Init offers OpenSpec for web sessions
`init` SHALL plan, as an install the person confirms with the exact hook shown, a `SessionStart` hook in the repository's `.claude/settings.json` that installs the OpenSpec command line in a session of Claude Code on the web when it is missing, and SHALL list the line as already done when the hook is there. The hook SHALL run nothing outside a remote session and nothing when OpenSpec already runs. `init` SHALL keep every other setting of the file, SHALL leave the changed file for the person to commit, and SHALL NOT write the hook when the person declines.

#### Scenario: A repository without the hook
- **WHEN** `.claude/settings.json` has no `SessionStart` hook that installs OpenSpec
- **THEN** the plan has an install line that shows the hook, and nothing is written before the person says yes

#### Scenario: A settings file with other settings
- **WHEN** the person agrees and `.claude/settings.json` already holds other settings or other hooks
- **THEN** the hook is added next to them and none of them changes

#### Scenario: A repository that already has the hook
- **WHEN** `.claude/settings.json` has a `SessionStart` hook that installs OpenSpec
- **THEN** the line is reported as already in place and nothing is added twice

#### Scenario: A settings file that cannot be read
- **WHEN** `.claude/settings.json` is not valid JSON
- **THEN** the line is a manual one that asks the person to fix the file, and `init` does not touch it

#### Scenario: The person declines
- **WHEN** the person says no to the hook
- **THEN** `init` continues and writes nothing for it, and `doctor` keeps warning in a remote session

### Requirement: Doctor warns when a web session has no OpenSpec hook
When `doctor` runs inside a remote session and the repository's `.claude/settings.json` has no `SessionStart` hook that installs OpenSpec, it SHALL report a warning with the fix next to it, and the warning SHALL NOT be a failure. It SHALL report nothing about the hook when it does not run in a remote session. It SHALL NOT change anything.

#### Scenario: A remote session without the hook
- **WHEN** `doctor` runs with `CLAUDE_CODE_REMOTE` set to `true` and the repository has no such hook
- **THEN** it reports a warning that names the hook and says to run `/relevo:init`

#### Scenario: A remote session with the hook
- **WHEN** `doctor` runs in a remote session and the hook is there
- **THEN** it reports a passed check

#### Scenario: A terminal
- **WHEN** `doctor` runs outside a remote session
- **THEN** it reports no check about the hook, whether or not the hook exists
