## MODIFIED Requirements

### Requirement: Gate 2, dependencies
`go` SHALL NOT build an issue whose `Depends-on` issues are not all merged, whether they are in this repository or in a linked one.

#### Scenario: Blocked
- **WHEN** a dependency is open
- **THEN** the issue is labelled `blocked` and the queue moves to the next eligible issue

#### Scenario: Blocked by another repository
- **WHEN** a dependency is `acme/api#12` and it is open
- **THEN** the issue is labelled `blocked` and the notice names `acme/api#12`

## ADDED Requirements

### Requirement: The gate resolves external dependencies against the linked repositories
Before gate 2, the planner SHALL check every external reference against `links`. A reference outside the list SHALL send the issue to `needs-spec` with the reason `missing`, and the comment SHALL name the repository and list the linked ones.

#### Scenario: Not linked
- **WHEN** the ready issue says `Depends-on: other/repo#4` and `other/repo` is not in `links`
- **THEN** the decision is `needs-spec`, nothing is read from `other/repo`, and no run starts
