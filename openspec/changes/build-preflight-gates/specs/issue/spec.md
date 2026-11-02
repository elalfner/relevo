## ADDED Requirements

### Requirement: An issue can declare the external inputs of its work
The issue MAY have a section `External inputs` whose bullets each give `<kind>: <name>: <what it is for>`, with kind `file`, `link`, `secret`, `variable` or `manual`. The check SHALL fail a bullet with an unknown kind, a `file` that leaves the repository, or a `link` to a repository outside `links`, and SHALL pass an issue without the section.

#### Scenario: A valid section
- **WHEN** the issue lists a file of the repository, a file of a linked repository and a secret
- **THEN** the check passes

#### Scenario: An unknown kind
- **WHEN** a bullet uses a kind that is not in the list
- **THEN** the check fails and names the bullet and the kinds that exist

#### Scenario: A link outside `links`
- **WHEN** a bullet points to a repository that is not in `links`
- **THEN** the check fails and says to add the repository to `links`

#### Scenario: No section
- **WHEN** the issue has no `External inputs` section
- **THEN** the check passes

### Requirement: `issue` asks for the external inputs
`issue` SHALL ask which keys, assets, endpoints, files of other repositories or accounts the work needs that the issue does not already state, and SHALL write the answers in the `External inputs` section. It SHALL say that an input that a script cannot verify is listed in the hand-off for a person to confirm, and SHALL NOT invent an input.

#### Scenario: The work needs a key
- **WHEN** the idea needs an API key that no file of the repository holds
- **THEN** `issue` asks where it lives and writes it as a `secret` or `manual` input

#### Scenario: Nothing is needed
- **WHEN** the person says the work needs nothing outside the repository
- **THEN** `issue` writes no section
