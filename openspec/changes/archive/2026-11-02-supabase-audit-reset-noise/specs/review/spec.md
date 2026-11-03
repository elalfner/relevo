## MODIFIED Requirements

### Requirement: The audit of a Supabase review separates expected denials from errors
For the `supabase` stack the audit SHALL classify what the database container logged since the review started. `FATAL`, `PANIC`, a detected deadlock and an out-of-memory message SHALL be findings, except the single entry `FATAL:  role "postgres" does not exist`, which `supabase db reset` writes while it recreates the database: that entry SHALL be counted and listed in the report as an expected startup entry and SHALL NOT be a finding. An `ERROR` whose message is a permission denial (`permission denied`), a row-level security violation (`violates row-level security policy`) or a constraint violation (`violates ... constraint`, `duplicate key`) SHALL be counted and listed in the report as an expected denial and SHALL NOT be a finding while a recorded run exited 0. Any other `ERROR` SHALL be a finding. The audit SHALL NOT assume that a pgTAP test of a policy writes its denials to the log: a denial caught by `throws_ok` is not logged, and the report SHALL say that the proof of a denial is the recorded run and its assertions, not the log. The person MAY waive a finding with a reason, as in any `api` review.

#### Scenario: Denial provoked by a policy test
- **WHEN** a run exited 0 and the slice has three `new row violates row-level security policy` errors
- **THEN** the report lists three expected denials and the verdict can be `REVIEW PASSED`

#### Scenario: Policy test that logs nothing
- **WHEN** a run exited 0 with assertions and the slice has only `create extension` and `drop extension` statements
- **THEN** the verdict can be `REVIEW PASSED` and the report says that no denial appears in the log and that the run is the proof

#### Scenario: Denials with a failing run
- **WHEN** a run exited non-zero and the slice has `permission denied` errors
- **THEN** the verdict is `REVIEW REJECTED` on the run, and the report names the failing assertions

#### Scenario: Other error
- **WHEN** a run exited 0 and the slice has `ERROR: relation "orders" does not exist` or a syntax error
- **THEN** the verdict is `REVIEW REJECTED` and the finding can be waived by the person with a reason

#### Scenario: Fatal
- **WHEN** the slice has a `FATAL` or `PANIC` entry other than the startup entry of a database reset
- **THEN** the verdict is `REVIEW REJECTED`

#### Scenario: Database reset with a good migration
- **WHEN** a run exited 0 and the slice holds the log of a `supabase db reset`, with `FATAL:  role "postgres" does not exist` and no other `FATAL` or `ERROR`
- **THEN** the report lists the entry as an expected startup entry and the verdict can be `REVIEW PASSED`

#### Scenario: Database reset with a broken migration
- **WHEN** the slice holds the log of a `supabase db reset` whose migration has a syntax error
- **THEN** the verdict is `REVIEW REJECTED` on the `ERROR` of the migration, and the startup entry is not a finding
