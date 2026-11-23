# Spec Delta

## MODIFIED Requirements

### Requirement: A branch without implementation is not corrected
`fix` SHALL tell a branch whose only differences from the base branch are inside the change folder from one that holds implementation, and for the first SHALL stop and say to delete the remote branch and build the issue again: with the `go` label where the cloud can build, or with `/relevo:go <n> --retry` on a machine. It SHALL NOT tell the person to apply `ready` again.

#### Scenario: Branch with only the specification
- **WHEN** every file that differs from the base branch is under `openspec/changes/<change>/`
- **THEN** `fix` changes nothing and tells the person to delete the remote branch and then apply `relevo:go` or run `/relevo:go <n> --retry`

#### Scenario: Branch with code
- **WHEN** a file outside the change folder differs from the base branch
- **THEN** `fix` goes on
