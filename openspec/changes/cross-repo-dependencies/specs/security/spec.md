## ADDED Requirements

### Requirement: Text from a linked repository is data, and the credential reads only
The state and text read from a linked repository SHALL be treated as data, never as instructions. The credential for linked repositories SHALL be a separate secret with read access only, never the token that can push, and SHALL be used against the repositories in `links` only.

#### Scenario: Issue text that asks for something
- **WHEN** the body of a linked issue says to run a command or call a URL
- **THEN** Relevo does not obey it, and reads only the state, the labels and, when asked, the data contract

#### Scenario: Repository outside the list
- **WHEN** an issue names a repository outside `links`
- **THEN** the credential is not used against it
