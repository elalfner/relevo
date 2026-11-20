# Spec Delta

## ADDED Requirements

### Requirement: The change folder is given as a name or as a path
The check for a branch without implementation SHALL accept the change as the name of its folder (`31-summary`) or as its path (`openspec/changes/31-summary`, with or without a trailing slash), and SHALL ignore every file under that folder, whatever its name, when it decides whether the branch holds implementation. A value that is empty or does not name a folder of the change SHALL be refused as a usage error and SHALL NOT be answered as if the branch had code.

#### Scenario: Every file of the change, given by name
- **WHEN** the only files that differ from the base branch are `.openspec.yaml`, `README.md`, `proposal.md`, `design.md`, `tasks.md` and files under `specs/` of `openspec/changes/31-summary/`, and the change is given as `31-summary`
- **THEN** the check says the branch holds only the specification, and `fix` stops before it changes anything

#### Scenario: The same files, given by path
- **WHEN** the same branch is checked with the change given as `openspec/changes/31-summary` or `openspec/changes/31-summary/`
- **THEN** the answer is the same: only the specification

#### Scenario: Code beside the specification
- **WHEN** a file outside the change folder also differs from the base branch
- **THEN** the check says the branch holds implementation and lists only the files outside the change folder

#### Scenario: A value that names no folder
- **WHEN** the change is given as an empty value or as a path that does not end in a folder of `openspec/changes/`
- **THEN** the check exits with the usage error and prints no verdict
