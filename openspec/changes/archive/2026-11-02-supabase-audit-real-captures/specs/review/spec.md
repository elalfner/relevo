## MODIFIED Requirements

### Requirement: The audit of a Supabase review separates expected denials from errors
For the `supabase` stack the audit SHALL classify what the database container logged since the review started. `FATAL`, `PANIC`, a detected deadlock and an out-of-memory message SHALL be findings. An `ERROR` whose message is a permission denial (`permission denied`), a row-level security violation (`violates row-level security policy`) or a constraint violation (`violates ... constraint`, `duplicate key`) SHALL be counted and listed in the report as an expected denial and SHALL NOT be a finding while a recorded run exited 0. Any other `ERROR` SHALL be a finding. The audit SHALL NOT assume that a pgTAP test of a policy writes its denials to the log: a denial caught by `throws_ok` is not logged, and the report SHALL say that the proof of a denial is the recorded run and its assertions, not the log. The person MAY waive a finding with a reason, as in any `api` review.

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
- **WHEN** the slice has a `FATAL` or `PANIC` entry
- **THEN** the verdict is `REVIEW REJECTED`

### Requirement: A pgTAP run is recorded with its assertions
For the `supabase` stack a recorded run SHALL carry the file or files passed to `supabase test db` (or none for the whole suite), the number of assertions that ran, the names of the assertions that failed and the exit code. The number of assertions SHALL be read from the summary line `Files=F, Tests=N` (a passing run prints no `ok N` lines) and the failing names from `# Failed test N: "name"` lines, or from `not ok` lines when the output has them. A run whose output has no assertion (`Tests=0`, `skipped` or `No tests run!`), or whose plan was not completed (`Bad plan`, `Looks like you planned`), SHALL count as a run that ran no test. A run told by the person (`ran <exit code>`) SHALL be recorded as the person's, without assertions, and the pull request SHALL say which runs were the person's and which the agent's.

#### Scenario: Passing run
- **WHEN** the output ends with `All tests successful.`, `Files=1, Tests=4` and `Result: PASS`
- **THEN** the run is recorded with exit 0 and 4 assertions

#### Scenario: Failing assertion
- **WHEN** the output has `# Failed test 1: "orders is gone"` and `Failed 1/4 subtests`
- **THEN** the run is recorded with exit non-zero, 4 assertions and that name as failing

#### Scenario: Plan not completed
- **WHEN** the output says `# Looks like you planned 3 tests but ran 2`
- **THEN** the run is recorded as failed, whatever the exit code

#### Scenario: File that ran no assertion
- **WHEN** the output has `No tests run!` or `Files=1, Tests=0`
- **THEN** the run is recorded as a run that ran no test

#### Scenario: Run told by the person
- **WHEN** the person says `ran 0`
- **THEN** the run is recorded as the person's, and the pull request says that no assertions were counted
