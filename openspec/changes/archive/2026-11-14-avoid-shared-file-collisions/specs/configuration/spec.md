## ADDED Requirements

### Requirement: Shared-file settings
`relevo.yml` SHALL support `queue.append_only` (a list of path globs that issues only add lines to), `integration.generated` (a list of path globs of generated files), `integration.regenerate` (the one command that regenerates them) and `limits.shared_file_wait_hours` (a whole number of at least 1, 24 by default). The list settings default to empty lists and the command to none.

#### Scenario: Defaults
- **WHEN** none of them is set
- **THEN** no file is excluded from the comparison, no generated file is regenerated, and an issue waits at most 24 hours

#### Scenario: Settings given
- **WHEN** `queue.append_only` is `["src/nav/items.ts"]`, `integration.generated` is `["src/gql/**"]`, `integration.regenerate` is `npm run codegen` and the wait is 8
- **THEN** validation passes and the queue and `go` use those values

#### Scenario: A malformed entry
- **WHEN** `integration.generated` is set without `integration.regenerate`, or `limits.shared_file_wait_hours` is 0 or not a whole number
- **THEN** validation fails and says which key is wrong

#### Scenario: A command that leaves the repository
- **WHEN** an `integration.generated` or `queue.append_only` glob is absolute or climbs out of the repository with `..`
- **THEN** validation fails, as it does for the other path settings
