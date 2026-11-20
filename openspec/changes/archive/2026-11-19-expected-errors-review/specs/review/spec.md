# Review

## ADDED Requirements

### Requirement: The audit of a declared adapter treats the errors a repository lists as expected
For a declared adapter the audit SHALL treat a Postgres `ERROR:` line whose message (the text after the first `ERROR:`) contains an entry of `review.expected_errors` as an expected error: listed in the report with the entry that matched and its count, and not a finding, while a run is recorded. With no run recorded it SHALL be a finding of the class `denial`. The list SHALL come from the state recorded at `init` and SHALL be read only for a declared adapter.


#### Scenario: Provoked errors with a listed code
- **WHEN** a run exited 0, the list holds `bitacora_inmutable` and the slice holds three `ERROR:  bitacora_inmutable: no se puede modificar` lines and nothing else
- **THEN** the verdict is `REVIEW PASSED` and the report lists the pattern with 3 matches, not as findings

#### Scenario: No run recorded
- **WHEN** no run is recorded and the slice holds a listed error
- **THEN** it is a `denial` finding

#### Scenario: Not a declared adapter
- **WHEN** the review is of `supabase` or `laravel` and `init` is given `--expected-error`
- **THEN** `init` fails and says that the list goes with a declared adapter

#### Scenario: Empty list
- **WHEN** the list is empty or absent
- **THEN** the audit classifies as before

### Requirement: An expected error never excuses a fatal signal and a waiver stays the person's
A line that carries a `FATAL` or `PANIC` level, a deadlock, an out-of-memory message or an HTTP status of 500 or above SHALL stay a finding whatever the list says, and an `ERROR:` line that matches no entry and no denial SHALL stay a `database-error` finding. The report SHALL say that the patterns are the repository's declaration. The agent SHALL NOT add a pattern to a profile or waive a finding: waiving stays the person's decision.

#### Scenario: Unlisted error
- **WHEN** the list holds `bitacora_inmutable` and the slice also holds `ERROR:  relation "x" does not exist`
- **THEN** the verdict is `REVIEW REJECTED` with one `database-error` finding

#### Scenario: Fatal entry with a listed word
- **WHEN** the slice holds `FATAL:  bitacora_inmutable` and the list holds `bitacora_inmutable`
- **THEN** the verdict is `REVIEW REJECTED` with a `fatal` finding

#### Scenario: Deadlock or out of memory
- **WHEN** the slice holds `ERROR:  deadlock detected` or `ERROR:  out of memory`
- **THEN** the verdict is `REVIEW REJECTED` whatever the list holds

#### Scenario: Server error
- **WHEN** the slice holds a response with status 500
- **THEN** the verdict is `REVIEW REJECTED` whatever the list holds
