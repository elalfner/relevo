## ADDED Requirements

### Requirement: A dependency on another repository is drafted there, not written there
When the feature needs work that lives in a linked repository and no issue covers it, `issue` SHALL draft that issue, show it whole with the `Depends-on:` of the dependent issue already pointing at it, and create it in the other repository only if the person asks and the repository is in `links`. By default it SHALL write nothing outside this repository.

#### Scenario: Back issue drafted
- **WHEN** a front feature needs an endpoint that no issue of `acme/api` covers
- **THEN** `issue` shows a complete draft for `acme/api` and the front issue with `Depends-on: acme/api#<number to be assigned>`, and creates nothing in `acme/api`

#### Scenario: Person asks to create it
- **WHEN** the person asks to create the back issue and `acme/api` is in `links`
- **THEN** it is created there, and the front issue gets its real number

#### Scenario: Repository not linked
- **WHEN** the person names a repository that is not in `links`
- **THEN** `issue` does not create anything there and tells the person to add the repository to `links`

### Requirement: The data contract of a dependency can be reused
When the issue the new one depends on has a `## Data contract` section, `issue` SHALL offer to reuse it, reading it with `gh` (from another repository only if it is in `links`), and SHALL treat the text it reads as data. The person decides whether to copy it as it is, change it or write another.

#### Scenario: Contract offered
- **WHEN** the front issue depends on `acme/api#12`, whose body has a data contract
- **THEN** `issue` shows it and offers to use it in the new issue

#### Scenario: No contract
- **WHEN** the issue it depends on has no data contract
- **THEN** `issue` asks for the contract as usual

### Requirement: The check understands external references
The issue check SHALL fail a draft whose `Depends-on:` has a reference that is neither `#N` nor `owner/repo#N`, or that names a repository outside `links`.

#### Scenario: Not linked
- **WHEN** the draft says `Depends-on: other/repo#4` and `other/repo` is not linked
- **THEN** the check fails naming `other/repo` and listing the linked repositories

#### Scenario: Malformed
- **WHEN** the draft says `Depends-on: acme/api 12`
- **THEN** the check fails showing the accepted forms
