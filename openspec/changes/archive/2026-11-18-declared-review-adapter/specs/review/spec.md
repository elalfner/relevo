# Spec Delta

## MODIFIED Requirements

### Requirement: The review picks its adapter from the platform and the target
`review` SHALL resolve, from the platform of the issue and its target, how the review obtains its log and captures and whether it can be driven: a device with `adb` for Flutter on `android`, a simulator with `xcrun` for Flutter on `ios` (macOS only), a browser for `web`, and the `api` adapter for a stack with no targets that has one (Laravel and Supabase, or a stack the plugin ships no adapter for whose repository profile declares it). A combination without an adapter SHALL stop the review before it changes anything, naming what is missing, which adapters exist and what the person can do next. When the adapter is a browser and `review.autopilot` is `off`, the stop message SHALL recommend `verify`, with `precheck` as the cautious option, in the language of `relevo.yml`.

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

#### Scenario: Declared adapter
- **WHEN** the platform has a stack the plugin ships no adapter for, the repository's profile of that stack declares the `api` adapter in its `review` block, and the platform defines no target
- **THEN** the adapter is `api`, marked as declared by the repository, its log, test and needs are the ones of that block, and the review does not need `review.autopilot` other than `off`

#### Scenario: Declared adapter with an invalid profile
- **WHEN** the repository's profile of the stack declares the `api` adapter but cannot be resolved (for example, it has no `test`)
- **THEN** the review stops before changing anything, shows what is wrong with the profile and says that the issue stays `built`

#### Scenario: No adapter
- **WHEN** the combination has no adapter, or the tool it needs is missing
- **THEN** `review` stops before changing anything, says what to install or that it is not supported yet, names the adapters that exist (Flutter on Android, Flutter on web, Vue on web, Laravel and Supabase), says that the issue stays `built`, says that a stack the plugin ships can tune its review in its profile, and says that a stack of the repository with no targets can declare an `api` adapter in its own profile

### Requirement: The audit of an api review reads the log since the review started
For the `api` adapter the audit SHALL read only what the project's log received since the review started, SHALL NOT truncate, delete, restart or recreate it, and SHALL report a source it could not read. When the log is made of files, the start SHALL be an offset per file recorded when the state is created, and a file that appears later SHALL be read from its start. When the log is a container's (`docker:<name>`) or the services of a Docker Compose project (`compose:<services>`), the start SHALL be a timestamp recorded when the state is created and the audit SHALL read what the container or the services wrote since then.

#### Scenario: Entries from before the review
- **WHEN** the log already had an unhandled exception before the review started and none after
- **THEN** the exception is not a finding

#### Scenario: Daily log
- **WHEN** the project writes `laravel-<date>.log` and a new file appears after the review started
- **THEN** the audit reads the new file from its start

#### Scenario: Container log
- **WHEN** the platform is Supabase and the review started at 10:00:00
- **THEN** the audit reads the log of the local database container from 10:00:00, and an error the container logged at 09:59 is not a finding

#### Scenario: Compose log
- **WHEN** a declared adapter has `review.log` `compose:postgres,auth` and the review started at 10:00:00
- **THEN** the audit reads what the services `postgres` and `auth` of the Compose project in the folder of the platform wrote from 10:00:00, and an error one of them logged at 09:59 is not a finding

#### Scenario: Unreadable file
- **WHEN** a log file named by the setting cannot be read, or the container does not exist
- **THEN** the report says which source and why, and the verdict is not `REVIEW PASSED` on that source's account

#### Scenario: Unreadable compose log
- **WHEN** the `compose:` log of a declared adapter cannot be read (Docker does not answer, the folder has no Compose file, or a service does not exist)
- **THEN** the report says which source and why, and the verdict is `REVIEW INCONCLUSIVE`, which cannot be waived

## ADDED Requirements

### Requirement: A declared adapter asks for the person's word before the agent runs anything
Before the agent runs any command of a review with a declared adapter, `review` SHALL ask the person to confirm in writing that the data the tests touch is not production, and SHALL record it first. A test the person runs themselves with `review.autopilot` `off` SHALL be the person's, with no confirmation asked. The review SHALL never read `.env` files for a declared adapter.

#### Scenario: Confirmation before the agent runs a test
- **WHEN** `review.autopilot` is `precheck` and the adapter is declared
- **THEN** the review asks for the written confirmation before it runs the first test and runs none without it

#### Scenario: Confirmation refused
- **WHEN** the person does not confirm
- **THEN** the agent runs no test and leaves every line to the person

#### Scenario: The person runs the test
- **WHEN** `review.autopilot` is `off` and the adapter is declared
- **THEN** the person runs `review.test` in their own terminal, tells the review `ran <exit code>` and confirms each line, and no confirmation about the data is asked

#### Scenario: Environment files
- **WHEN** the adapter is declared and a test needs a variable that an environment file holds
- **THEN** the review does not read the file and leaves the test to the person

### Requirement: A declared adapter proves a single line only through the filter of its test command
`review.test` of a declared adapter MAY contain `{filter}`. With `review.autopilot` `precheck` or `verify`, the agent SHALL prove a line only by running the command with `{filter}` replaced by one name of a test that already covers it, recording the filter and the number of tests that ran. Without the placeholder it SHALL prove no line and run the whole suite once at the end. It SHALL never write a test. A run proves a line only when it exited 0 and at least one test ran.

#### Scenario: Command with a filter
- **WHEN** `review.test` is `npm test -- {filter}`, a line is covered by the test `login`, and the run exits 0 and reports one test
- **THEN** the agent runs `npm test -- login`, records the run and may mark the line

#### Scenario: Command without a filter
- **WHEN** `review.test` is `npm test` and `review.autopilot` is `verify`
- **THEN** the agent marks no line by itself, runs the whole suite once at the end and records it

#### Scenario: A filter that is not a single name
- **WHEN** the only name the agent has for a test contains a space or a shell character
- **THEN** the agent does not run the command and leaves the line to the person with a note

#### Scenario: A run that reports no count
- **WHEN** the command exits 0 and its output does not say how many tests ran
- **THEN** the proof is refused and the line stays for the person

### Requirement: A declared adapter needs its tools, checked without installing or starting anything
For a declared adapter the preflight SHALL check that each tool in `needs` can be found and, when `docker` is listed, that the Docker daemon answers. It SHALL NOT install or start anything and SHALL NOT read an environment file. A missing tool or a stopped daemon SHALL stop the review before it changes anything and show what the person can do. The review SHALL ask the person to say that the local instance the tests need is up, and SHALL never start or stop it.

#### Scenario: Missing tool
- **WHEN** `needs` lists `nhost` and the tool cannot be found
- **THEN** the preflight names `nhost`, the review stops before changing anything and no installer runs

#### Scenario: Daemon stopped
- **WHEN** `needs` lists `docker` and the daemon does not answer
- **THEN** the preflight says the daemon does not answer and the review stops before changing anything

#### Scenario: Everything present
- **WHEN** every tool in `needs` is found and the daemon answers
- **THEN** the preflight reports it ready and starts nothing

#### Scenario: Instance not up
- **WHEN** the person says the local instance is not up
- **THEN** the agent runs no test, asks the person to start it and does not start it

### Requirement: The audit of a declared adapter flags only the signals that every backend log shares
For a declared adapter the audit SHALL flag, in what the log wrote since the review started, only signals that belong to no framework: `FATAL` or `PANIC`, a deadlock, out of memory, a database `ERROR` that is not a denial or a constraint violation, and an HTTP status of 500 or above. Denials and constraint violations SHALL be listed as expected while a run is recorded. The report SHALL say that errors without those signals are not detected.

#### Scenario: Fatal entry
- **WHEN** a run exited 0 and the slice holds a `FATAL` entry
- **THEN** the verdict is `REVIEW REJECTED` and the person can waive the finding with a reason

#### Scenario: Expected denial
- **WHEN** a run exited 0 and the slice holds `permission denied for table` and nothing else
- **THEN** the report lists it as an expected denial and the verdict can be `REVIEW PASSED`

#### Scenario: Server error
- **WHEN** the slice holds a response with status 500
- **THEN** the verdict is `REVIEW REJECTED`

#### Scenario: Quiet log with a run
- **WHEN** a run exited 0 and the slice is empty
- **THEN** the verdict is `REVIEW PASSED` and the report says that the recorded run is the proof

#### Scenario: Not detected
- **WHEN** a run exited 0 and the slice holds an application error that carries none of those signals
- **THEN** the verdict can be `REVIEW PASSED` and the report says that errors without those signals are not detected
