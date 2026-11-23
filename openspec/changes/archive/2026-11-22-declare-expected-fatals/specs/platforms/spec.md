## ADDED Requirements

### Requirement: A declared adapter's profile can list the fatal messages its test harness provokes
The `review` block of a repository profile MAY carry `expected_fatals`, a list of whole messages of `FATAL:` lines, each of 3 to 100 characters made of letters, digits, space and `_ . : , ' / -`, the first one a letter or digit. The plugin's profiles, `nhost` included, SHALL NOT carry it. An entry SHALL be invalid when it contains `PANIC`, `deadlock`, `out of memory`, `HTTP` or an HTTP status of 500 or above, compared with no regard to case, or when it starts with `FATAL`.

#### Scenario: Valid list
- **WHEN** the repository's `.relevo/stacks/nhost.md` sets `review.expected_fatals: [terminating autovacuum process due to administrator command]`
- **THEN** the resolved `review` block has the entry and the plugin's `log` and `test`

#### Scenario: Not a list of strings
- **WHEN** `review.expected_fatals` is a string, a map or has an empty entry
- **THEN** resolving the profile fails and names `review.expected_fatals`

#### Scenario: Unsafe characters
- **WHEN** an entry contains a quote, a backtick, `$`, a backslash or a newline
- **THEN** resolving the profile fails and names the entry

#### Scenario: Reserved word
- **WHEN** an entry is `PANIC: could not write`, `deadlock detected`, `out of memory`, `500` or `FATAL: terminating autovacuum process`
- **THEN** resolving the profile fails and names the entry

#### Scenario: No default for Nhost
- **WHEN** the profile of `nhost` is resolved with no repository file
- **THEN** its `review` block has no `expected_fatals`

#### Scenario: The plugin's own profile
- **WHEN** a profile of the plugin sets `review.expected_fatals`
- **THEN** resolving the profile fails and says that the key belongs in the repository's profile

### Requirement: expected_fatals is honored only for a declared adapter
The key SHALL be honored for the repository's `adapter: api` and for `nhost`. For any other stack it SHALL be removed from the resolved `review` block and listed as ignored, and `stack-profile.mjs --role review` SHALL print the list and the warning for an ignored key.

#### Scenario: Shipped stack that is not declared
- **WHEN** the repository's profile of `supabase` sets `review.expected_fatals`
- **THEN** the resolved `review` block has no `expected_fatals` and the key is listed as ignored

#### Scenario: Printed for the review
- **WHEN** the resolved profile of `nhost` has the list and `--role review` runs
- **THEN** the output's `review.expected_fatals` holds it
