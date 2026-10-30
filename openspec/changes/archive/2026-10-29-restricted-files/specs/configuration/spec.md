# Spec Delta

## ADDED Requirements

### Requirement: Restricted paths setting
`relevo.yml` SHALL accept `restricted_paths`, a list of paths or globs that is empty by default. Its entries are added to the base list of restricted files and can never remove one. A path in the list SHALL be relative to the repository, and an absolute path or a path that leaves the repository SHALL be rejected.

#### Scenario: Default
- **WHEN** the file does not set it
- **THEN** only the base list applies

#### Scenario: A project adds its own
- **WHEN** `restricted_paths` lists `infra/prod.tfvars`
- **THEN** that file is restricted in addition to the base list

#### Scenario: A project tries to lift a base entry
- **WHEN** `restricted_paths` or a profile of the repository names `.env` in a way that would allow it
- **THEN** `.env` stays restricted and validation reports that the base list cannot be reduced

#### Scenario: Invalid value
- **WHEN** an entry is `/etc/passwd` or `../outside`
- **THEN** validation fails and names the setting and the entry
