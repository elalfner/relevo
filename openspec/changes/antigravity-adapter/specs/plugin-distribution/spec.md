## ADDED Requirements

### Requirement: One command sets up the plugin of each tool
`relevo init` SHALL ask which tools to set up and whether the scope is the project or the machine, SHALL install each tool's plugin, and SHALL run without waiting when `--tools`, `--scope` and `--yes` are given or when there is no terminal.

#### Scenario: Asking in a terminal
- **WHEN** a person runs `relevo init` in a terminal inside a repository
- **THEN** a list of tools appears, then a list of scopes with the project preselected, and each tool is installed with the choice

#### Scenario: Cancelling
- **WHEN** the person presses Ctrl-C or Esc at a list
- **THEN** nothing is installed and the command says it was cancelled

#### Scenario: No terminal
- **WHEN** `relevo init --tools antigravity` runs without a terminal and without `--scope`
- **THEN** it does not wait: it uses the project inside a git repository and the machine outside one, and says which

#### Scenario: Claude chosen
- **WHEN** `claude` is among the tools
- **THEN** the command does what `relevo install` does for the scope and renders nothing for Claude

#### Scenario: Antigravity is not installed
- **WHEN** `agy` is not on the path and the machine scope is chosen
- **THEN** the command stops, says that Antigravity CLI is required and where to get it, and changes nothing

#### Scenario: Not to be confused with the skill
- **WHEN** `relevo init` finishes
- **THEN** it tells the person that the skill `init` sets up the repository's labels and rules, as a separate step

### Requirement: Doctor checks the rendered plugin
`relevo doctor` SHALL report, for each rendered plugin, a missing file, a file from another package version and a file edited by hand.

#### Scenario: Outdated plugin
- **WHEN** the recorded version is older than the installed package
- **THEN** doctor warns and names `relevo update` as the fix
