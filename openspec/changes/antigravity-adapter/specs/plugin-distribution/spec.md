## ADDED Requirements

### Requirement: One command generates the files of other tools
`relevo init` SHALL ask which tools to set up and whether the scope is the project or the machine, SHALL write the generated files and the manifest, and SHALL run without waiting when `--tools`, `--scope` and `--yes` are given or when there is no terminal.

#### Scenario: Asking in a terminal
- **WHEN** a person runs `relevo init` in a terminal inside a repository
- **THEN** a list of tools appears, then a list of scopes with the project preselected, and the files are written to the choice

#### Scenario: Cancelling
- **WHEN** the person presses Ctrl-C or Esc at a list
- **THEN** nothing is written and the command says it was cancelled

#### Scenario: No terminal
- **WHEN** `relevo init --tools antigravity` runs without a terminal and without `--scope`
- **THEN** it does not wait: it uses the project inside a git repository and the machine outside one, and says which

#### Scenario: Claude chosen
- **WHEN** `claude` is among the tools
- **THEN** the command runs the plugin installation of `relevo install` for the scope and generates no Claude files

#### Scenario: The package is not on the path
- **WHEN** `relevo` is not on the PATH of the shell that will run the generated files
- **THEN** the command says so and how to install the package

#### Scenario: Not to be confused with the skill
- **WHEN** `relevo init` finishes
- **THEN** it tells the person that the skill `init` sets up the repository's labels and rules, as a separate step

### Requirement: Doctor checks the generated files
`relevo doctor` SHALL report, for each tool in the manifest, a missing file, a file from another package version and a file edited by hand.

#### Scenario: Outdated files
- **WHEN** the manifest records an older package version than the installed one
- **THEN** doctor warns and names `relevo update` as the fix
