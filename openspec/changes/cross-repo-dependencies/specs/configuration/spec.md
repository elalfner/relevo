## ADDED Requirements

### Requirement: Linked repositories setting
`relevo.yml` SHALL support `links`, a list of `owner/repo` names (default: empty). A malformed name or a repeated one SHALL fail validation naming the entry.

#### Scenario: Valid list
- **WHEN** `links` is `[acme/api, acme/design]`
- **THEN** validation passes and both are linked

#### Scenario: Malformed name
- **WHEN** `links` contains `acme` or `acme/api/extra`
- **THEN** validation fails and says the form is `owner/repo`

#### Scenario: Repeated name
- **WHEN** `links` lists `acme/api` twice
- **THEN** validation fails naming `acme/api`
