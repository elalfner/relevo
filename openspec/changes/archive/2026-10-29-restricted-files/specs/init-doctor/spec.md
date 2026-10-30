# Spec Delta

## ADDED Requirements

### Requirement: Init proposes the read denials for local use
`init` SHALL include in its plan the read denials for the restricted files in the settings of each agent the repository uses on a person's machine, show their exact text, and write them only after a yes to that item alone. It SHALL add to the settings the person already has and SHALL NOT remove or reorder an existing entry. Declining SHALL change nothing else and SHALL NOT make a later step fail.

#### Scenario: Offered for Claude Code
- **WHEN** the plan is shown and the project's `.claude/settings.json` has no `Read` denial for `.env`
- **THEN** the plan lists the `permissions.deny` entries and the `sandbox.filesystem.denyRead` entries as one optional item with their exact text, and nothing is written before the person says yes to it

#### Scenario: Existing settings are kept
- **WHEN** the settings file already has entries the person wrote
- **THEN** the accepted item adds the missing denials and leaves every other entry as it was

#### Scenario: Declined
- **WHEN** the person declines the item
- **THEN** `init` continues, says the denials stay open, and `doctor` keeps the warning

### Requirement: Doctor checks the read denials by path name
`doctor` SHALL check, for each agent the repository uses, that the restricted files have a read denial in its settings, and SHALL warn for each restricted path that has none. It SHALL compare path names only and SHALL NOT open a restricted file. A missing denial SHALL be a warning, never a failure, because the settings of a person are theirs.

#### Scenario: Denials present
- **WHEN** the settings deny the read of every restricted path that exists in the repository
- **THEN** the check passes

#### Scenario: Denial missing
- **WHEN** `.env` exists in the working folder and no `Read` denial covers it
- **THEN** `doctor` warns, names the path and says that `/relevo:init` proposes the entries

#### Scenario: A versioned restricted file
- **WHEN** a restricted file is tracked by git
- **THEN** `doctor` reports a failure that names the path, because a versioned secret is already in the history

#### Scenario: Doctor stays read-only
- **WHEN** the check runs
- **THEN** no restricted file is opened and nothing is written
