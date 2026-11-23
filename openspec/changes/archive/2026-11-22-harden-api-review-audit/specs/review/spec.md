## MODIFIED Requirements

### Requirement: The audit of an api review reads the log since the review started
For the `api` adapter the audit SHALL read only what the project's log received since the review started, SHALL NOT truncate, delete, restart or recreate it, and SHALL report a source it could not read. When the log is made of files, the start SHALL be an offset per file recorded when the state is created, and a file that appears later SHALL be read from its start. When the log is a container's (`docker:<name>`) or the services of a Docker Compose project (`compose:<services>`), the start SHALL be a timestamp recorded when the state is created and the audit SHALL read what the container or the services wrote since then. The services of a Compose log SHALL be read one at a time, every service of the project when none is listed, and the output of one read SHALL be allowed at least 256 MiB. A service that cannot be read SHALL be reported by its own name with the reason, and SHALL NOT keep the audit from reading the others.

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
- **THEN** the audit reads what the services `postgres` and `auth` of the Compose project in the folder of the platform wrote from 10:00:00, one service at a time, and an error one of them logged at 09:59 is not a finding

#### Scenario: Every service
- **WHEN** a declared adapter has `review.log` `compose:` with no service
- **THEN** the audit lists the services of the Compose project and reads each of them since the review started

#### Scenario: Unreadable file
- **WHEN** a log file named by the setting cannot be read, or the container does not exist
- **THEN** the report says which source and why, and the verdict is not `REVIEW PASSED` on that source's account

#### Scenario: Unreadable compose log
- **WHEN** the `compose:` log of a declared adapter cannot be read (Docker does not answer, the folder has no Compose file, or a service does not exist)
- **THEN** the report says which source and why, and the verdict is `REVIEW INCONCLUSIVE`, which cannot be waived

#### Scenario: One service too large
- **WHEN** the log of the service `postgres` since the review started is larger than the read allows and the other services are readable
- **THEN** the report names `postgres` as the unreadable source, says that the buffer was exceeded, says that `reset-log` moves the start of the window and that the runs recorded so far then stop proving it, and the verdict is `REVIEW INCONCLUSIVE`

### Requirement: A recorded test run proves an api review whose log is quiet
For the `api` adapter, an empty log slice SHALL be `REVIEW INCONCLUSIVE` only when no test run is recorded in the review state, and SHALL be `REVIEW PASSED` when a run is recorded and the latest run of each line or filter exited 0, so a run repeated after a fix replaces the one before. A latest run with a non-zero exit code SHALL be `REVIEW REJECTED` and name the failing tests. The log slice SHALL still be scanned for unhandled exceptions, server errors and database errors. A run told by the person SHALL be recorded as the person's, and the pull request SHALL say which runs were the person's and which the agent's. When the start of the log was reset after runs were recorded, a run recorded before the reset SHALL NOT prove the new window: the verdict SHALL be `REVIEW INCONCLUSIVE`, saying that no run is recorded since the reset, until a run is recorded after it. A failing run recorded before the reset SHALL still stand until a later run of the same line or filter replaces it.

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

#### Scenario: Empty window after a reset
- **WHEN** a run exited 0, then the log was reset, then the audit runs with an empty slice and no run recorded since
- **THEN** the verdict is `REVIEW INCONCLUSIVE`, the reason says that no run is recorded since the log was reset, and it cannot be waived

#### Scenario: Run after the reset
- **WHEN** the log was reset and a run exiting 0 is recorded after it, and the slice is empty
- **THEN** the verdict is `REVIEW PASSED`

#### Scenario: Failing run before the reset
- **WHEN** a run for a line exited 1, then the log was reset, and no later run of that line is recorded
- **THEN** the verdict is `REVIEW REJECTED` and names the failing run

### Requirement: A declared adapter needs its tools, checked without installing or starting anything
For a declared adapter the preflight SHALL check that each tool in `needs` can be found and, when `docker` is listed, that the Docker daemon answers. It SHALL NOT install or start anything and SHALL NOT read the content of an environment file. A missing tool or a stopped daemon SHALL stop the review before it changes anything and show what the person can do. The review SHALL ask the person to say that the local instance the tests need is up, and SHALL never start or stop it. The preflight SHALL also check the checkout by the existence of paths only: when `npm` is in `needs` and the folder has a `package.json`, that `node_modules` exists, and when the folder has a `.env.example` or `.env.sample`, that `.env` exists. A missing path SHALL NOT stop the review: the preflight SHALL name it and the review SHALL ask the person to confirm before any test or server runs.

#### Scenario: Missing tool
- **WHEN** `needs` lists `nhost` and the tool cannot be found
- **THEN** the preflight names `nhost`, the review stops before changing anything and no installer runs

#### Scenario: Daemon stopped
- **WHEN** `needs` lists `docker` and the daemon does not answer
- **THEN** the preflight says the daemon does not answer and the review stops before changing anything

#### Scenario: Everything present
- **WHEN** every tool in `needs` is found, the daemon answers and the checkout has what it needs
- **THEN** the preflight reports it ready and starts nothing

#### Scenario: Instance not up
- **WHEN** the person says the local instance is not up
- **THEN** the agent runs no test, asks the person to start it and does not start it

#### Scenario: Checkout without dependencies
- **WHEN** `needs` lists `npm`, the folder has a `package.json` and no `node_modules`
- **THEN** the preflight names `node_modules`, gives the install command for the person to run, installs nothing, and the review asks before running any test

#### Scenario: Checkout without environment file
- **WHEN** the folder has a `.env.example` and no `.env`
- **THEN** the preflight names `.env`, never opens either file, and the review asks before running any test

#### Scenario: No example file
- **WHEN** the folder has no `.env.example` and no `.env.sample` and no `.env`
- **THEN** the preflight does not mention an environment file

## ADDED Requirements

### Requirement: The Compose project in use is compared with the checkout under review
For a declared adapter with a `compose:` log, `init` and the preflight SHALL read, without changing anything, the working directory that Docker Compose recorded for the running project, and SHALL warn when it is not the folder of the platform being reviewed, naming both folders and the branch of each when it is known. A warning SHALL NOT stop the review. When the running project cannot be found or the working directory is not recorded, the review SHALL say so and go on.

#### Scenario: Instance from another worktree
- **WHEN** the Compose project is running from the folder of another worktree
- **THEN** the review names that folder and the folder under review and warns that the tests exercise the code the instance runs, which may be another branch

#### Scenario: Same folder
- **WHEN** the recorded working directory is the folder of the platform
- **THEN** the review says nothing about it

#### Scenario: Not running
- **WHEN** no Compose project is running
- **THEN** the review says that no running project was found and does not warn about a folder

### Requirement: The state of a review belongs to one change
The state of a review SHALL record the name of the change and the kind of review (`device`, `api` or iOS) it was created for. `init` SHALL refuse to overwrite a state that belongs to another change or kind, and say which. `review-state.mjs owner <change-dir>` SHALL exit 0 when the state is for that change and that kind, and exit 1 naming what differs when it is not. A state that records no change SHALL be reported as one whose owner is unknown, and the review SHALL ask the person whether it is theirs before resuming it.

#### Scenario: State of another issue
- **WHEN** `evidence/review-state.json` was created for `add-login` and the review of `rename-orders` starts
- **THEN** `init` refuses, names both changes, and leaves the file as it is

#### Scenario: State of another kind
- **WHEN** the file holds an `api` state and the review is a device review of the same change
- **THEN** `owner` exits 1 and says the state is for an `api` review

#### Scenario: Same change
- **WHEN** the state was created for the change being resumed
- **THEN** `owner` exits 0 and the review resumes

#### Scenario: Older state
- **WHEN** the state records no change
- **THEN** `owner` says the owner is unknown and the review asks the person before resuming it
