## MODIFIED Requirements

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
