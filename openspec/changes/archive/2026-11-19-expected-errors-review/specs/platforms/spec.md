# Platforms

## ADDED Requirements

### Requirement: A declared adapter's profile can list the errors its tests provoke on purpose
The `review` block of a repository profile MAY carry `expected_errors`, a list of plain substrings of 3 to 100 characters made of letters, digits, space and `_ . : , ' / -`, the first one a letter or digit. The plugin's profiles, `nhost` included, SHALL NOT carry it.

#### Scenario: Valid list
- **WHEN** the repository's `.relevo/stacks/nhost.md` sets `review.expected_errors: [permiso_denegado, bitacora_inmutable]`
- **THEN** the resolved `review` block has both entries and the plugin's `log` and `test`

#### Scenario: Not a list of strings
- **WHEN** `review.expected_errors` is a string, a map or has an empty entry
- **THEN** resolving the profile fails and names `review.expected_errors`

#### Scenario: Unsafe characters
- **WHEN** an entry contains a quote, a backtick, `$`, a backslash or a newline
- **THEN** resolving the profile fails and names the entry

#### Scenario: No default for Nhost
- **WHEN** the profile of `nhost` is resolved with no repository file
- **THEN** its `review` block has no `expected_errors`

### Requirement: An entry of expected_errors cannot name a fatal signal
An entry SHALL be invalid when it contains, or is a part of, `FATAL`, `PANIC`, `deadlock`, `out of memory`, `ERROR`, `HTTP` or an HTTP status of 500 or above, compared with no regard to case.

#### Scenario: Reserved word
- **WHEN** an entry is `FATAL`, `deadlock detected`, `out of memory`, `ERROR` or `500`
- **THEN** resolving the profile fails and names the entry

### Requirement: expected_errors is honored only for a declared adapter
The key SHALL be honored for the repository's `adapter: api` and for `nhost`. For any other stack it SHALL be removed from the resolved `review` block and listed as ignored, and `stack-profile.mjs --role review` SHALL print the list and the warning for an ignored key.

#### Scenario: Shipped stack that is not declared
- **WHEN** the repository's profile of `supabase` sets `review.expected_errors`
- **THEN** the resolved `review` block has no `expected_errors` and the key is listed as ignored

#### Scenario: Printed for the review
- **WHEN** the resolved profile of `nhost` has the list and `--role review` runs
- **THEN** the output's `review.expected_errors` holds it
