# Spec Delta

## ADDED Requirements

### Requirement: The execution page says which branch the cloud reads and where a build starts
The page on where `go` runs SHALL state, in English and Spanish, that a label event runs the workflows of the default branch and reads `relevo.yml` from it, that the branch of a build always starts from `origin/<branches.base>` in the cloud and on a machine whatever the default branch is, and what changes when the base branch is the default branch.

#### Scenario: The default branch is the release branch
- **WHEN** a person whose default branch is `main` and base branch is `dev` reads the page
- **THEN** it says that builds still branch from `dev`, and that a change to `relevo.yml` on `dev` reaches the cloud only after promotion

#### Scenario: The base setting on the configuration page
- **WHEN** a person reads the `branches.base` row of the configuration page
- **THEN** it says that every build branch starts from it and its pull request targets it
