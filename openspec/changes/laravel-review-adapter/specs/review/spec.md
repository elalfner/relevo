# Spec Delta

## MODIFIED Requirements

### Requirement: Local session with a device
`review` SHALL run in a local session. When the adapter of the platform is a device, it SHALL need a connected device and, when none is connected, SHALL stop and say so. An adapter of another kind needs no device.

#### Scenario: No device
- **WHEN** the adapter is a device and no device appears in the device list
- **THEN** the command stops with instructions to connect one

#### Scenario: Adapter without a device
- **WHEN** the adapter of the platform is the `api` one and no device is connected
- **THEN** the review does not look for a device and goes on

### Requirement: The review picks its adapter from the platform and the target
`review` SHALL resolve, from the platform of the issue and its target, how the review obtains its log and captures and whether it can be driven: a device with `adb` for Flutter on `android`, a simulator with `xcrun` for Flutter on `ios` (macOS only), a browser for `web`, and the `api` adapter for a stack with no targets that has one (Laravel). A combination without an adapter SHALL stop the review before it changes anything, naming what is missing, which adapters exist and what the person can do next. When the adapter is a browser and `review.autopilot` is `off`, the stop message SHALL recommend `verify`, with `precheck` as the cautious option, in the language of `relevo.yml`.

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

#### Scenario: No adapter
- **WHEN** the combination has no adapter, or the tool it needs is missing
- **THEN** `review` stops before changing anything, says what to install or that it is not supported yet, names the adapters that exist, says that the issue stays `built`, and says that a stack the plugin ships can tune its review in its profile

## ADDED Requirements

### Requirement: An api review has no device and no capture
For the `api` adapter the review SHALL need no device, no browser and no capture, and SHALL brief the person with the checklist and without a shot list. The person SHALL confirm every checklist line in every autopilot mode. With `review.autopilot` `off` the person runs the project's tests and writes the result of each line; the agent only records and audits.

#### Scenario: Autopilot off
- **WHEN** the adapter is `api` and `review.autopilot` is `off`
- **THEN** the review starts, the brief has the checklist and no shot list, the agent runs no test, and the person's `ok`, `fail` and `ran` lines are recorded

#### Scenario: Capture asked for
- **WHEN** the person asks for a capture in an `api` review
- **THEN** the agent says that this adapter takes none and records nothing

### Requirement: The agent proves a line of an api review with an existing test
With `review.autopilot` `precheck` or `verify`, the agent SHALL prove a line of an `api` review only by running the feature test that already covers its scenario, never by writing or editing a test, and SHALL record the filter it used, the number of tests that ran and the exit code. A run that matched no test SHALL be a failed proof. With `verify` a line SHALL be marked `ok (auto)` only when the exit code proves its `THEN`; a line with no covering test, or one whose test does not assert its `THEN`, SHALL stay for the person.

#### Scenario: A test covers the line
- **WHEN** `review.autopilot` is `verify` and the test for line 2 ran once and exited 0
- **THEN** line 2 is `ok (auto)` and the pull request lists it with the test name

#### Scenario: Precheck
- **WHEN** `review.autopilot` is `precheck` and the test for line 2 exited 0
- **THEN** line 2 is recorded as pre-checked and stays pending until the person confirms it

#### Scenario: A filter that matches nothing
- **WHEN** the filter matched no test
- **THEN** the proof fails, the line stays pending and the agent says no test was found

#### Scenario: No test for the line
- **WHEN** no test of the project covers a line
- **THEN** the agent does not write one, and the line is left to the person with a note that it has no test

### Requirement: The audit of an api review reads the log since the review started
For the `api` adapter the audit SHALL read only what the project's log files received since the review started, recorded as an offset per file when the state is created, SHALL treat a file that appears later as new from its start, and SHALL NOT truncate or delete a log. It SHALL report a file it could not read.

#### Scenario: Entries from before the review
- **WHEN** the log already had an unhandled exception before the review started and none after
- **THEN** the exception is not a finding

#### Scenario: Daily log
- **WHEN** the project writes `laravel-<date>.log` and a new file appears after the review started
- **THEN** the audit reads the new file from its start

#### Scenario: Unreadable file
- **WHEN** a log file named by the setting cannot be read
- **THEN** the report says which file and why, and the verdict is not `REVIEW PASSED` on that file's account

### Requirement: A recorded test run proves an api review whose log is quiet
For the `api` adapter, an empty log slice SHALL be `REVIEW INCONCLUSIVE` only when no test run is recorded in the review state, and SHALL be `REVIEW PASSED` when a run is recorded and the latest run of each line or filter exited 0, so a run repeated after a fix replaces the one before. A latest run with a non-zero exit code SHALL be `REVIEW REJECTED` and name the failing tests. The log slice SHALL still be scanned for unhandled exceptions, server errors and database errors. A run told by the person SHALL be recorded as the person's, and the pull request SHALL say which runs were the person's and which the agent's.

#### Scenario: Clean run, empty log
- **WHEN** a test run exited 0 and the log slice is empty
- **THEN** the verdict is `REVIEW PASSED`

#### Scenario: No run recorded
- **WHEN** no run is recorded and the log slice is empty
- **THEN** the verdict is `REVIEW INCONCLUSIVE` and the person is asked to run the tests and say so

#### Scenario: Failing run
- **WHEN** a recorded run exited non-zero
- **THEN** the verdict is `REVIEW REJECTED` and the report names the failing tests

#### Scenario: Run repeated after a fix
- **WHEN** a run for a line exited 1 and a later run for the same line exited 0
- **THEN** only the later run counts and the verdict can be `REVIEW PASSED`

#### Scenario: Error in the log
- **WHEN** a run exited 0 and the slice has an unhandled exception
- **THEN** the verdict is `REVIEW REJECTED` and the finding can be waived by the person with a reason

#### Scenario: Not waivable
- **WHEN** the person tries to waive an inconclusive audit of an `api` review
- **THEN** the waiver is refused

### Requirement: An api review checks its tools and the test database before running
Before an `api` review runs a test, the review SHALL check that PHP and Composer can be found, that the installed dependencies match the lock file, and which database the test configuration declares, without reading the real environment files. A database other than in-memory SQLite, or one the test configuration does not declare, SHALL need the person's written confirmation that it is not production before any test or server runs. The review SHALL install nothing; for missing dependencies it SHALL give the command for the person to run.

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

### Requirement: An api review may start its own server on its own port
When the profile's `review` block names a `serve` command, the agent MAY, with `review.autopilot` `precheck` or `verify` and after the person confirmed the data, start that server on a free localhost port through the script that records and stops it, wait until its URL answers, and stop only the servers it recorded. Every server SHALL be listed in the plan of the walk before the person confirms. The review SHALL reach only `localhost` on that port. Without a `serve` command the agent SHALL start no server.

#### Scenario: Server configured
- **WHEN** `serve` is set, `review.autopilot` is `verify` and the data is confirmed
- **THEN** the agent starts it on a free port, waits for its URL, runs the lines that need it and stops it afterwards

#### Scenario: No serve
- **WHEN** the profile has no `serve` command
- **THEN** the agent starts no server, and the lines that need one are left to the person

#### Scenario: Another origin
- **WHEN** a line needs a request to an address that is not `localhost` on the port of the server
- **THEN** the agent does not make it, and `review.allowed_origins` does not widen an `api` review

#### Scenario: A server that was not the agent's
- **WHEN** a stop is asked for a server the agent did not start
- **THEN** nothing is stopped
