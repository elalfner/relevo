# Spec Delta

## ADDED Requirements

### Requirement: Init offers the Relevo plugin for web sessions
`init` SHALL plan, as an install the person confirms with the exact hook shown, a second `SessionStart` hook in the repository's `.claude/settings.json` that adds the Relevo marketplace and installs the Relevo plugin at the project scope in a session of Claude Code on the web, and SHALL list the line as already done when the hook is there. The hook SHALL run nothing outside a remote session, SHALL write what the commands print to a log file, and SHALL NOT make the session fail when the install fails. The plan SHALL say why it is needed: a cloud session does not load the plugins that a repository only declares.

#### Scenario: A repository without the plugin hook
- **WHEN** `.claude/settings.json` has no `SessionStart` hook that installs the Relevo plugin
- **THEN** the plan has an install line that shows the hook, and nothing is written before the person says yes to it alone

#### Scenario: Both hooks in one file
- **WHEN** the person agrees to this hook and the file already has the hook that installs OpenSpec
- **THEN** both hooks are in the file, each once, and no other setting or hook changes

#### Scenario: A repository that already has it
- **WHEN** `.claude/settings.json` has a `SessionStart` hook that installs the Relevo plugin
- **THEN** the line is reported as already in place and nothing is added twice

#### Scenario: A settings file that cannot be read
- **WHEN** `.claude/settings.json` is not valid JSON
- **THEN** the line is a manual one that asks the person to fix the file, and `init` does not touch it

#### Scenario: The person declines
- **WHEN** the person says no to the hook
- **THEN** `init` continues and writes nothing for it, and `doctor` keeps warning in a remote session

### Requirement: Doctor warns when a web session has no plugin hook
When `doctor` runs inside a remote session and the repository's `.claude/settings.json` has no `SessionStart` hook that installs the Relevo plugin, it SHALL report a warning, not a failure, that says a cloud session does not load a plugin that is only declared, and give `/relevo:init` as the fix. It SHALL report nothing about the hook outside a remote session and SHALL NOT change anything.

#### Scenario: A remote session without the hook
- **WHEN** `doctor` runs with `CLAUDE_CODE_REMOTE` set to `true` and the repository has no such hook
- **THEN** it reports a warning that names the hook and says to run `/relevo:init`

#### Scenario: A remote session with the hook
- **WHEN** `doctor` runs in a remote session and the hook is there
- **THEN** it reports a passed check

#### Scenario: A terminal
- **WHEN** `doctor` runs outside a remote session
- **THEN** it reports no check about the plugin hook, whether or not the hook exists
