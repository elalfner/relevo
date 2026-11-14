## ADDED Requirements

### Requirement: Shared-file settings
`relevo.yml` SHALL support `queue.append_only` (a list of path globs that issues only add lines to), `integration.generated` (a list of entries with `paths`, a list of globs, and `command`, how the files are regenerated) and `limits.shared_file_wait_hours` (a whole number of at least 1, 24 by default). The first two default to empty lists.

#### Scenario: Defaults
- **WHEN** none of the three is set
- **THEN** no file is excluded from the comparison, no generated file is regenerated, and an issue waits at most 24 hours

#### Scenario: Settings given
- **WHEN** `queue.append_only` is `["src/nav/items.ts"]`, `integration.generated` is `[{ paths: ["src/gql/**"], command: "npm run codegen" }]` and the wait is 8
- **THEN** validation passes and the queue and `go` use those values

#### Scenario: A malformed entry
- **WHEN** an `integration.generated` entry has no `command`, or `limits.shared_file_wait_hours` is 0 or not a whole number
- **THEN** validation fails and says which key is wrong

#### Scenario: A command that leaves the repository
- **WHEN** a `paths` glob is absolute or climbs out of the repository with `..`
- **THEN** validation fails, as it does for the other path settings
