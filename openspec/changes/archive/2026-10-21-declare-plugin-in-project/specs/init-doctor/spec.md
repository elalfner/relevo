# Spec Delta

## ADDED Requirements

### Requirement: Init declares the plugin in the project
`init` SHALL plan, as an install the person confirms with its exact command shown, the declaration of the Relevo plugin in the repository's `.claude/settings.json` when it does not declare both the marketplace and the enabled plugin, and SHALL list the line as already done when it does. It SHALL leave the changed settings file for the person to commit.

#### Scenario: A repository that does not declare the plugin
- **WHEN** `.claude/settings.json` is missing, or has no `relevo@relevo` enabled
- **THEN** the plan has an install line with the commands that install the plugin at the project scope, and nothing runs before the person says yes to that exact command

#### Scenario: A repository that already declares it
- **WHEN** `.claude/settings.json` declares the marketplace and enables `relevo@relevo`
- **THEN** the line is reported as already in place

#### Scenario: A settings file that cannot be read
- **WHEN** `.claude/settings.json` is not valid JSON
- **THEN** the line is a manual step that says to fix the file, and init does not rewrite it

### Requirement: Doctor warns when the repository does not declare the plugin
`doctor` SHALL warn, not fail, when the repository does not declare and enable the Relevo plugin in `.claude/settings.json`, say that a teammate who clones the repository is not offered it, and give the command or `/relevo:init` as the fix.

#### Scenario: Installed for the machine only
- **WHEN** the plugin is installed for the machine and `.claude/settings.json` does not declare it
- **THEN** doctor warns and names the fix

#### Scenario: Declared
- **WHEN** `.claude/settings.json` declares the marketplace and enables the plugin
- **THEN** doctor reports it as a pass
