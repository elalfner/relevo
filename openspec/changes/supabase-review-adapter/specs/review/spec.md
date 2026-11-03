# Spec Delta

## MODIFIED Requirements

### Requirement: The review picks its adapter from the platform and the target
`review` SHALL resolve, from the platform of the issue and its target, how the review obtains its log and captures and whether it can be driven: a device with `adb` for Flutter on `android`, a simulator with `xcrun` for Flutter on `ios` (macOS only), a browser for `web`, and the `api` adapter for a stack with no targets that has one (Laravel and Supabase). A combination without an adapter SHALL stop the review before it changes anything, naming what is missing, which adapters exist and what the person can do next. When the adapter is a browser and `review.autopilot` is `off`, the stop message SHALL recommend `verify`, with `precheck` as the cautious option, in the language of `relevo.yml`.

#### Scenario: Android device
- **WHEN** the platform is Flutter with the target `android`
- **THEN** the adapter is the device with `adb`, and the review proceeds as before

#### Scenario: Web
- **WHEN** the platform is Vue with the target `web`
- **THEN** the adapter is the browser, and the review needs `review.autopilot` other than `off`

#### Scenario: Web with autopilot off
- **WHEN** the platform is Vue with the target `web` and `review.autopilot` is `off`
- **THEN** the review stops before changing anything, recommends `verify` and names `precheck` as the cautious option, and says that the person still confirms every line and that lines about appearance are never marked automatically

#### Scenario: Laravel
- **WHEN** the platform has the stack `laravel`, which defines no targets
- **THEN** the adapter is `api`, and the review does not need `review.autopilot` other than `off`

#### Scenario: Supabase
- **WHEN** the platform has the stack `supabase`, which defines no targets
- **THEN** the adapter is `api`, driven by `supabase test db`, and the review does not need `review.autopilot` other than `off`

#### Scenario: No adapter
- **WHEN** the combination has no adapter, or the tool it needs is missing
- **THEN** `review` stops before changing anything, says what to install or that it is not supported yet, names the adapters that exist (Flutter on Android, Flutter on web, Vue on web, Laravel and Supabase), says that the issue stays `built`, and says that a stack the plugin ships can tune its review in its profile

### Requirement: The agent proves a line of an api review with an existing test
With `review.autopilot` `precheck` or `verify`, the agent SHALL prove a line of an `api` review only by running the test that already covers its scenario (a feature test selected by a filter, or, for Supabase, a pgTAP file passed to `supabase test db`), never by writing or editing a test, and SHALL record the filter or file it used, the number of tests or assertions that ran and the exit code. A run that matched no test or no file, or whose pgTAP plan ran no assertion, SHALL be a failed proof. With `verify` a line SHALL be marked `ok (auto)` only when the exit code proves its `THEN`; a line with no covering test, or one whose test does not assert its `THEN`, SHALL stay for the person.

#### Scenario: A test covers the line
- **WHEN** `review.autopilot` is `verify` and the test for line 2 ran once and exited 0
- **THEN** line 2 is `ok (auto)` and the pull request lists it with the test name

#### Scenario: A pgTAP file covers the line
- **WHEN** `review.autopilot` is `verify`, the platform is Supabase and `supabase test db supabase/tests/orders_rls.test.sql` ran 6 assertions and exited 0
- **THEN** the line that file covers is `ok (auto)` and the pull request lists it with the file and the count

#### Scenario: Precheck
- **WHEN** `review.autopilot` is `precheck` and the test for line 2 exited 0
- **THEN** line 2 is recorded as pre-checked and stays pending until the person confirms it

#### Scenario: A filter that matches nothing
- **WHEN** the filter matched no test, the file does not exist, or the pgTAP file ran no assertion
- **THEN** the proof fails, the line stays pending and the agent says no test was found

#### Scenario: No test for the line
- **WHEN** no test of the project covers a line
- **THEN** the agent does not write one, and the line is left to the person with a note that it has no test

### Requirement: The audit of an api review reads the log since the review started
For the `api` adapter the audit SHALL read only what the project's log received since the review started, SHALL NOT truncate, delete, restart or recreate it, and SHALL report a source it could not read. When the log is made of files, the start SHALL be an offset per file recorded when the state is created, and a file that appears later SHALL be read from its start. When the log is a container's (`docker:<name>`), the start SHALL be a timestamp recorded when the state is created and the audit SHALL read what the container wrote since then.

#### Scenario: Entries from before the review
- **WHEN** the log already had an unhandled exception before the review started and none after
- **THEN** the exception is not a finding

#### Scenario: Daily log
- **WHEN** the project writes `laravel-<date>.log` and a new file appears after the review started
- **THEN** the audit reads the new file from its start

#### Scenario: Container log
- **WHEN** the platform is Supabase and the review started at 10:00:00
- **THEN** the audit reads the log of the local database container from 10:00:00, and an error the container logged at 09:59 is not a finding

#### Scenario: Unreadable file
- **WHEN** a log file named by the setting cannot be read, or the container does not exist
- **THEN** the report says which source and why, and the verdict is not `REVIEW PASSED` on that source's account

### Requirement: An api review checks its tools and the test database before running
Before an `api` review runs a test, the review SHALL check the tools of its stack without reading the real environment files. For Laravel it SHALL check that PHP and Composer can be found, that the installed dependencies match the lock file, and which database the test configuration declares; a database other than in-memory SQLite, or one the test configuration does not declare, SHALL need the person's written confirmation that it is not production before any test or server runs. For Supabase it SHALL check that the Supabase CLI can be found, that the Docker daemon answers, that `supabase/config.toml` exists and that the local stack is running; it SHALL need no confirmation about the database because the tests only ever run against the local containers. The review SHALL install and start nothing without showing it in the plan of the walk; for a missing tool or dependency it SHALL give the command for the person to run.

#### Scenario: In-memory SQLite
- **WHEN** the test configuration declares `sqlite` and `:memory:`
- **THEN** the check passes and no confirmation is asked

#### Scenario: Another database
- **WHEN** the test configuration declares a MySQL or PostgreSQL connection
- **THEN** the review names it, asks for the confirmation, and runs no test until the person gives it

#### Scenario: No database declared
- **WHEN** the test configuration declares no database
- **THEN** the review says the database is unknown and asks for the same confirmation

#### Scenario: Missing dependencies
- **WHEN** `vendor/` does not exist
- **THEN** the review stops, runs no installer and gives the Composer command for the person to run

#### Scenario: Supabase ready
- **WHEN** the CLI is found, Docker answers, `supabase/config.toml` exists and the local stack is running
- **THEN** the check passes and no confirmation is asked

#### Scenario: Docker not running
- **WHEN** the Supabase CLI is found and the Docker daemon does not answer
- **THEN** the review stops before running a test and tells the person to start Docker

#### Scenario: Local stack stopped
- **WHEN** the CLI and Docker are fine and the local stack is not running
- **THEN** the review says so; with `review.autopilot` `off` it asks the person to run `supabase start`, and with `precheck` or `verify` it lists `supabase start` in the plan of the walk and runs it only after the person confirms, and it stops only a stack it started

#### Scenario: Missing config
- **WHEN** `supabase/config.toml` does not exist in the folder of the platform
- **THEN** the review stops, runs nothing and says to run `supabase init` or to check the platform's path

## ADDED Requirements

### Requirement: A Supabase review only touches the local database
For the `supabase` stack the review SHALL run `supabase test db` and `supabase db lint` only against the local containers. A command of the review SHALL NOT carry `--linked` or `--db-url`, SHALL NOT run `supabase link`, `supabase db push`, `supabase db pull`, `supabase db reset --linked` or any command that reaches a remote project, and SHALL NOT read `.env` files or `supabase/.temp`. A `review.test` that names one of those flags SHALL be refused.

#### Scenario: Linked project
- **WHEN** the folder of the platform is linked to a remote project
- **THEN** the review runs its tests against the local containers, never with `--linked`, and says nothing about the remote project

#### Scenario: Test command that targets a remote database
- **WHEN** `review.test` in `.relevo/stacks/supabase.md` is `supabase test db --linked`
- **THEN** resolving the profile fails and names the key

#### Scenario: Agent asked to push
- **WHEN** a line of the checklist says to apply the migration to the staging project
- **THEN** the agent does not run it, and the line is left to the person with a note that a review is local only

### Requirement: The audit of a Supabase review separates expected denials from errors
For the `supabase` stack the audit SHALL classify what the database container logged since the review started. `FATAL`, `PANIC`, a detected deadlock and an out-of-memory message SHALL be findings. An `ERROR` whose message is a permission denial (`permission denied`), a row-level security violation (`violates row-level security policy`) or a constraint violation (`violates ... constraint`, `duplicate key`) SHALL be counted and listed in the report as an expected denial, because a pgTAP test of a policy provokes them on purpose, and SHALL NOT be a finding while a recorded run exited 0. Any other `ERROR` SHALL be a finding. The person MAY waive a finding with a reason, as in any `api` review.

#### Scenario: Denial provoked by a policy test
- **WHEN** a run exited 0 and the slice has three `new row violates row-level security policy` errors
- **THEN** the report lists three expected denials and the verdict can be `REVIEW PASSED`

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
For the `supabase` stack a recorded run SHALL carry the file or files passed to `supabase test db` (or none for the whole suite), the number of assertions that ran, the names of the assertions that failed (`not ok` lines) and the exit code. A run whose output has no assertion, or whose plan was not completed, SHALL count as a run that ran no test. A run told by the person (`ran <exit code>`) SHALL be recorded as the person's, without assertions, and the pull request SHALL say which runs were the person's and which the agent's.

#### Scenario: Failing assertion
- **WHEN** the output has `not ok 4 - anon cannot read orders`
- **THEN** the run is recorded with exit non-zero and that name as failing

#### Scenario: Plan not completed
- **WHEN** the output says `Looks like you planned 6 tests but ran 4`
- **THEN** the run is recorded as failed, whatever the exit code

#### Scenario: Run told by the person
- **WHEN** the person says `ran 0`
- **THEN** the run is recorded as the person's, and the pull request says that no assertions were counted
