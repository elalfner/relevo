# Spec Delta

## MODIFIED Requirements

### Requirement: Init offers the Relevo plugin for web sessions
`init` SHALL plan, as an install the person confirms with the exact hook shown, a second `SessionStart` hook in the repository's `.claude/settings.json` that adds the Relevo marketplace and installs the Relevo plugin at the local scope in a session of Claude Code on the web, and SHALL list the line as already done when the hook is there. The hook SHALL run nothing outside a remote session, SHALL write what the commands print to a log file, SHALL NOT make the session fail when the install fails, and SHALL NOT change any file that the repository tracks. The plan SHALL say why it is needed: a cloud session does not load the plugins that a repository only declares.

#### Scenario: A repository without the plugin hook
- **WHEN** `.claude/settings.json` has no `SessionStart` hook that installs the Relevo plugin
- **THEN** the plan has an install line that shows the hook, and nothing is written before the person says yes to it alone

#### Scenario: Both hooks in one file
- **WHEN** the person agrees to this hook and the file already has the hook that installs OpenSpec
- **THEN** both hooks are in the file, each once, and no other setting or hook changes

#### Scenario: A repository that already has it
- **WHEN** `.claude/settings.json` has a `SessionStart` hook that installs the Relevo plugin at the local scope
- **THEN** the line is reported as already in place and nothing is added twice

#### Scenario: A settings file that cannot be read
- **WHEN** `.claude/settings.json` is not valid JSON
- **THEN** the line is a manual one that asks the person to fix the file, and `init` does not touch it

#### Scenario: The person declines
- **WHEN** the person says no to the hook
- **THEN** `init` continues and writes nothing for it, and `doctor` keeps warning in a remote session

#### Scenario: A web session with the hook leaves the repository clean
- **WHEN** a new web session starts on a repository whose settings file declares the plugin and has this hook
- **THEN** the plugin is installed and enabled for the session, and the tracked files of the repository are as they were

## ADDED Requirements

### Requirement: Init updates a plugin hook that installs at the project scope
When the repository's `.claude/settings.json` has a `SessionStart` hook that installs the Relevo plugin at the project scope, `init` SHALL plan its update as an install the person confirms, showing the command that is there and the command that replaces it. On a yes it SHALL replace only that command, keeping every other setting and hook of the file, and SHALL leave the changed file for the person to commit.

#### Scenario: An older hook
- **WHEN** the hook installs at the project scope
- **THEN** the plan has an update line that shows both commands, and nothing is written before the person says yes to it alone

#### Scenario: Other hooks in the file
- **WHEN** the person agrees and the file has other hooks, including the one that installs OpenSpec
- **THEN** only the plugin hook changes and the others stay as they are

#### Scenario: Run again
- **WHEN** `init` runs after the update
- **THEN** the line is reported as already in place and the file is not written

### Requirement: Doctor warns when the plugin hook installs at the project scope
When `doctor` runs inside a remote session and the plugin hook installs at the project scope, it SHALL report a warning, not a failure, that says the install rewrites the tracked settings file and the session may open a pull request for it, and give `/relevo:init` as the fix. It SHALL report nothing about this outside a remote session and SHALL NOT change anything.

#### Scenario: A remote session with an older hook
- **WHEN** `doctor` runs with `CLAUDE_CODE_REMOTE` set to `true` and the hook installs at the project scope
- **THEN** it reports the warning and names `/relevo:init`

#### Scenario: A remote session with the current hook
- **WHEN** the hook installs at the local scope
- **THEN** it reports no warning about the scope

#### Scenario: A terminal
- **WHEN** `doctor` runs outside a remote session
- **THEN** it reports nothing about the scope of the hook
