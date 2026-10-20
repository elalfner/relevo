## ADDED Requirements

### Requirement: A design reference is a section the check understands
The issue MAY have a `Design reference` section whose bullets each point to a file of this repository, a pasted attachment, a file of a linked repository (`owner/repo:path`) or a fenced block of example code, and say after a colon what must match. The check SHALL fail a bullet that points to a file that does not exist or leaves the repository, to a repository outside `links`, to an attachment outside the GitHub domains, that does not say what must match, or beyond the fifth.

#### Scenario: File of the repository
- **WHEN** a bullet points to `design/home.png` and the file exists
- **THEN** the check passes

#### Scenario: File that does not exist
- **WHEN** a bullet points to `design/missing.png`
- **THEN** the check fails and names the bullet

#### Scenario: Repository not linked
- **WHEN** a bullet points to `acme/design:Card.vue` and `acme/design` is not in `links`
- **THEN** the check fails and says the repository is not in `links`

#### Scenario: Nothing says what must match
- **WHEN** a bullet has only a path
- **THEN** the check fails and asks what must match

### Requirement: Issue says what it cannot do with a picture
`issue` SHALL write the section, SHALL tell the person that a picture cannot be attached by the tool and must be pasted from the web page of the issue before `ready`, and SHALL say that a pasted attachment is sent to the model only when `design.images` is on.

#### Scenario: Picture requested
- **WHEN** the person has a screenshot of the design
- **THEN** `issue` writes a bullet for it, tells them to paste it in the issue and what is sent to the model
