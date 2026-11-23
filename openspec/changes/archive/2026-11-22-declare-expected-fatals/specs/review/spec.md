## ADDED Requirements

### Requirement: The audit of a declared adapter treats the fatal messages a repository lists as expected
For a declared adapter the audit SHALL treat a `FATAL:` line whose message (the text after the first `FATAL:`, with whitespace collapsed) is equal to an entry of `review.expected_fatals` as an expected fatal: listed in the report with the entry that matched and its count, and not a finding, while a run is recorded. With no run recorded it SHALL be a finding of the class `fatal`. A message that only contains an entry, or that an entry only contains, SHALL NOT match. The list SHALL come from the state recorded at `init` and SHALL be read only for a declared adapter. The report SHALL say that these entries are the repository's declaration of what its own test harness provokes, and that a waiver stays the person's decision.

#### Scenario: Autovacuum ended by the harness
- **WHEN** a run exited 0, the list holds `terminating autovacuum process due to administrator command` and the slice holds three `FATAL:  terminating autovacuum process due to administrator command` lines and a `LOG:  checkpoint starting: immediate force wait`
- **THEN** the verdict is `REVIEW PASSED` and the report lists the entry with 3 matches, not as findings

#### Scenario: No run recorded
- **WHEN** no run is recorded and the slice holds a listed fatal
- **THEN** it is a `fatal` finding

#### Scenario: A longer or shorter message
- **WHEN** the list holds `terminating autovacuum process due to administrator command` and the slice holds `FATAL:  terminating connection due to administrator command` or `FATAL:  terminating autovacuum process due to administrator command, then more`
- **THEN** each is a `fatal` finding and the verdict is `REVIEW REJECTED`

#### Scenario: Unlisted fatal
- **WHEN** the list holds one entry and the slice also holds `FATAL:  the database system is shutting down`
- **THEN** the verdict is `REVIEW REJECTED` with one `fatal` finding

#### Scenario: Not a declared adapter
- **WHEN** the review is of `supabase` or `laravel` and `init` is given `--expected-fatal`
- **THEN** `init` fails and says that the list goes with a declared adapter

#### Scenario: Empty list
- **WHEN** the list is empty or absent
- **THEN** the audit classifies as before

## MODIFIED Requirements

### Requirement: An expected error never excuses a fatal signal and a waiver stays the person's
A line that carries a `FATAL` or `PANIC` level, a deadlock, an out-of-memory message or an HTTP status of 500 or above SHALL stay a finding whatever `review.expected_errors` says. The only exception is a `FATAL:` line whose whole message is an entry of `review.expected_fatals`, and it never reaches a `PANIC` line, a deadlock, an out-of-memory message or an HTTP status of 500 or above. An `ERROR:` line that matches no entry and no denial SHALL stay a `database-error` finding. The report SHALL say that the patterns are the repository's declaration. The agent SHALL NOT add a pattern to a profile or waive a finding: waiving stays the person's decision.

#### Scenario: Unlisted error
- **WHEN** the list holds `bitacora_inmutable` and the slice also holds `ERROR:  relation "x" does not exist`
- **THEN** the verdict is `REVIEW REJECTED` with one `database-error` finding

#### Scenario: Fatal entry with a listed word
- **WHEN** the slice holds `FATAL:  bitacora_inmutable` and `review.expected_errors` holds `bitacora_inmutable`
- **THEN** the verdict is `REVIEW REJECTED` with a `fatal` finding

#### Scenario: Deadlock or out of memory
- **WHEN** the slice holds `ERROR:  deadlock detected` or `ERROR:  out of memory`
- **THEN** the verdict is `REVIEW REJECTED` whatever either list holds

#### Scenario: Fatal signal on a listed message
- **WHEN** a `FATAL:` line has a message equal to an entry of `review.expected_fatals` and the same line carries `out of memory` or a response with status 500
- **THEN** it stays a finding

#### Scenario: Panic
- **WHEN** the slice holds `PANIC:  could not write to file`
- **THEN** the verdict is `REVIEW REJECTED` whatever either list holds

#### Scenario: Server error
- **WHEN** the slice holds a response with status 500
- **THEN** the verdict is `REVIEW REJECTED` whatever either list holds
