# Spec Delta

## MODIFIED Requirements

### Requirement: One command installs it
A command line, `relevo`, SHALL install the plugin for the machine, the project or the local scope, update it, run the doctor and print the version, and SHALL tell the person how to fix a missing prerequisite instead of failing silently. When no scope is given it SHALL ask in a terminal, with the project preselected, and otherwise use the project inside a git repository and the machine outside one, without waiting. `update` SHALL pass a scope only when one is given.

#### Scenario: Installing for a project
- **WHEN** a person runs `relevo install --scope project`
- **THEN** the marketplace is added and the plugin installed with the project scope, and the command says where the setting was written

#### Scenario: Claude Code is not installed
- **WHEN** `claude` is not on the path
- **THEN** the command stops, says Claude Code is required and how to install it, and changes nothing

#### Scenario: Choosing in a terminal
- **WHEN** a person runs `relevo install` with no scope in a terminal
- **THEN** a list of the project (with its folder), the machine and the local scope appears with the project selected, the arrows and Enter choose, and the install uses the choice

#### Scenario: Cancelling
- **WHEN** the person presses Ctrl-C or Esc at the list
- **THEN** nothing is installed or written, and the command says it was cancelled

#### Scenario: No terminal
- **WHEN** `relevo install` runs without a scope and without a terminal
- **THEN** it does not wait: it uses the project inside a git repository and the machine outside one, and says which and why

#### Scenario: Not inside a repository
- **WHEN** the folder is not inside a git repository
- **THEN** the list preselects the machine and says the folder is not a repository

#### Scenario: Updating
- **WHEN** a person runs `relevo update` without a scope
- **THEN** no scope is passed, so Claude Code updates the installation of the current project
