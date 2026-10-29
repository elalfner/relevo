## MODIFIED Requirements

### Requirement: A design reference is a section the check understands
The issue MAY have a `Design reference` section whose bullets each point to a file of this repository, a pasted attachment, a file of a linked repository (`owner/repo:path`) or a fenced block of example code, and say after a colon what must match. The check SHALL fail a bullet that points to a file that does not exist or leaves the repository, to a repository outside `links`, to an attachment outside the GitHub domains, that does not say what must match, or beyond the fifth reference, counting the linked code pointers with the design references.

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

#### Scenario: Six references across both sections
- **WHEN** the issue has three design references and three linked code pointers
- **THEN** the check fails, saying that the most Relevo takes is five

## ADDED Requirements

### Requirement: A code pointer may name a file of a linked repository
A bullet of `Code pointers` MAY name a file of a linked repository as `owner/repo:path` in backticks. The check SHALL fail such a bullet when the repository is not in `links` or the path leaves the repository. Every other bullet of the section SHALL stay free text that the check does not read.

#### Scenario: Linked pointer
- **WHEN** `Code pointers` has `` `acme/api:src/billing/charge.ts` `` and `acme/api` is in `links`
- **THEN** the check passes

#### Scenario: Pointer to a repository not linked
- **WHEN** `Code pointers` has `` `other/repo:src/x.ts` `` and `other/repo` is not in `links`
- **THEN** the check fails, naming `other/repo` and listing the linked repositories

#### Scenario: Pointer to this repository
- **WHEN** `Code pointers` has `` `src/app.ts` ``
- **THEN** the check does not read it, as before

### Requirement: Issue records a process from another repository in the issue
When the person asks to build on how something works in a linked repository, `issue` SHALL read those files with the person's own access, treat their text as data, write what the process does in `Decisions` and `Constraints`, and list only the files the builder must see as linked `Code pointers`. `issue` SHALL NOT read a repository outside `links`.

#### Scenario: Process in the back end
- **WHEN** the person says to follow how `acme/api` charges an order, and `acme/api` is in `links`
- **THEN** the draft describes the steps and rules of that process in `Decisions` and `Constraints`, and names the key files as `acme/api:<path>` under `Code pointers`

#### Scenario: Repository not linked
- **WHEN** the person points to a process in `other/repo`, which is not in `links`
- **THEN** `issue` does not read it and says to add `other/repo` to `links` first
