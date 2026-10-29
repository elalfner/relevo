# links Specification

## Purpose
TBD - created by archiving change cross-repo-dependencies. Update Purpose after archive.

## Requirements

### Requirement: An issue can depend on an issue of another repository
`Depends-on:` SHALL accept `owner/repo#N` as well as `#N`. A reference without a repository SHALL mean an issue of the same repository, and a reference that names the same repository SHALL mean the same as `#N`. A reference that is neither form SHALL be reported by the issue check.

#### Scenario: External reference
- **WHEN** an issue says `Depends-on: acme/api#12`
- **THEN** it depends on issue 12 of `acme/api`, not on issue 12 of its own repository

#### Scenario: Local reference
- **WHEN** an issue says `Depends-on: #12`
- **THEN** it depends on issue 12 of its own repository

#### Scenario: Own repository in full
- **WHEN** an issue of `acme/web` says `Depends-on: acme/web#12`
- **THEN** it depends on issue 12 of its own repository

#### Scenario: Mixed line
- **WHEN** an issue says `Depends-on: #3, acme/api#12`
- **THEN** it depends on both

### Requirement: Linked repositories are a closed list
`relevo.yml` SHALL list in `links` the repositories an issue may depend on. An external reference to a repository outside the list SHALL fail the gate, sending the issue to the specification writer with the list of linked repositories, and SHALL fail the issue check.

#### Scenario: Repository not linked
- **WHEN** an issue says `Depends-on: other/repo#4` and `links` does not list `other/repo`
- **THEN** the gate sends the issue to `needs-spec` naming `other/repo` and the linked repositories, and nothing is read from `other/repo`

#### Scenario: Linked repository
- **WHEN** `links` lists `acme/api` and an issue says `Depends-on: acme/api#12`
- **THEN** the gate reads the state of that issue

### Requirement: An external dependency is done when its issue is closed as completed
The gate SHALL treat an external dependency as satisfied only when its issue is closed as completed. An issue that cannot be read (the repository is private and no credential works, the issue does not exist) SHALL never count as satisfied: the issue stays blocked and the notice names the reference and says it could not be read.

#### Scenario: Dependency completed
- **WHEN** `acme/api#12` is closed as completed
- **THEN** the dependency is satisfied

#### Scenario: Dependency open
- **WHEN** `acme/api#12` is open or closed as not planned
- **THEN** the issue is blocked and the notice names `acme/api#12`

#### Scenario: Dependency unreadable
- **WHEN** `acme/api#12` cannot be read
- **THEN** the issue is blocked, and the notice says `acme/api#12` could not be read and which secret to check

### Requirement: A credential for reading, only for reading
Reading private linked repositories SHALL use a token stored as the secret `RELEVO_LINKS_TOKEN`, with read access to issues, pull requests and contents only. The token SHALL be used to read the issues that dependencies name and the files that the references of an issue name, and for nothing else. Public repositories SHALL be read without it. Relevo SHALL use that token only to read, and SHALL NOT use it to create or change anything in another repository.

#### Scenario: Private linked repository
- **WHEN** `acme/api` is private and the secret exists
- **THEN** the gate reads its issues with that token

#### Scenario: Public linked repository
- **WHEN** `acme/api` is public and no secret exists
- **THEN** the gate reads its issues without a credential

#### Scenario: File of a private linked repository
- **WHEN** `acme/design` is private, the secret exists, and an issue names `acme/design:screens/home.webp` as a reference
- **THEN** the fetcher reads that file with the token and writes nothing to `acme/design`

### Requirement: A waiting issue notices on the queue's schedule
An issue blocked by an external dependency SHALL be re-evaluated by the queue's scheduled run, because events do not cross repositories. It starts by itself when the dependency is completed.

#### Scenario: Dependency finishes in the other repository
- **WHEN** `acme/api#12` is closed as completed
- **THEN** the next scheduled queue run of the dependent repository unblocks the issue

### Requirement: Nothing is written to another repository without being asked
Relevo SHALL NOT create or change an issue in another repository on its own. A person can ask `issue` to create one, and only in a repository listed in `links`.

#### Scenario: Default
- **WHEN** a feature depends on work that does not exist yet in another repository
- **THEN** `issue` only drafts it and shows it
