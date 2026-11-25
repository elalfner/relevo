# Spec Delta

## ADDED Requirements

### Requirement: The issue skill writes a file when the tracker is files
With `tracker: files`, `/relevo:issue` SHALL draft, check and show the issue as it does today, and after approval SHALL write `.relevo/issues/<n>.md` and commit it, instead of creating a GitHub issue. It SHALL NOT ask for a milestone, an assignee or a repository. Its separate question about `ready` SHALL remain, and applying `ready` SHALL record the hash of the text.

#### Scenario: Approved draft
- **WHEN** the person approves a draft and answers `ready`
- **THEN** the file exists and is committed, the issue is `ready` and its text hash is stored

#### Scenario: No milestone question
- **WHEN** the project is a files project
- **THEN** the skill does not ask for a milestone or an assignee

### Requirement: Updating an issue file is allowed until it is built
`/relevo:issue <n>` SHALL update the text of an issue file that is not `building`, `built`, `in-review` or shipped, and SHALL withdraw `ready` when it changes the text, after telling the person.

#### Scenario: Edit a ready issue
- **WHEN** the person updates the text of a `ready` issue
- **THEN** `ready` is withdrawn and the person is asked whether to approve it again

#### Scenario: Issue being built
- **WHEN** the issue is `building`
- **THEN** the skill refuses to edit it
