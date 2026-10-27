# Spec Delta

## ADDED Requirements

### Requirement: Without OpenSpec go does not continue from memory
When the environment check finds that the OpenSpec command line does not run, `go` SHALL stop, show the command that installs it, and say that the change files must not be written by hand. It SHALL NOT create anything under `openspec/changes/`, and SHALL NOT go on by reading the code and recalling the format.

#### Scenario: OpenSpec is missing
- **WHEN** `go` runs and `openspec` does not run
- **THEN** it stops before claiming work or creating a branch
- **AND** the message gives the install command and says that nothing is written under `openspec/changes/` by hand

#### Scenario: The agent is tempted to continue
- **WHEN** the check has failed for OpenSpec
- **THEN** the text of the skill forbids going on, and the structure test of the plugin fails if it does not
