# Spec Delta

## MODIFIED Requirements

### Requirement: Concurrency and cost limits
`go` SHALL run at most one agent per issue and at most `limits.concurrent_agents` agents overall. A run that exceeds `limits.run_max_turns` or `limits.run_max_cost` SHALL be stopped by the runner: the agent cannot see its own counters and does not try to stop itself.

#### Scenario: Duplicate trigger
- **WHEN** the label event fires twice for the same issue
- **THEN** only one run executes

#### Scenario: Run exceeds its budget
- **WHEN** a run reaches its turn or cost limit
- **THEN** the runner stops it, the agent pushes nothing, and the final step of the workflow labels the issue `qa-failed` and comments with the job status and a link to the run

#### Scenario: Retry after a budget cut
- **WHEN** the person applies `ready` again after a run was cut by its limits
- **THEN** the issue is evaluated like any other, because the cut run pushed no branch

### Requirement: Unrecoverable problems end in qa-failed
Any problem `go` cannot recover from SHALL end in the `qa-failed` exit with a stated reason, and SHALL push the branch except when the reason is a possible credential, a temporary marker, a protected path in the diff or an issue that changed after `ready`, or when the branch already exists, which `go` never touches. It SHALL NOT open a pull request or advance the state.

#### Scenario: Branch already exists
- **WHEN** the feature branch already exists on the remote
- **THEN** `go` leaves it untouched and ends in `qa-failed` with the reason "branch already exists"

#### Scenario: Branch already exists with implementation commits
- **WHEN** the feature branch already exists on the remote and holds commits other than the specification commit
- **THEN** `go` leaves it untouched, ends in `qa-failed` with the reason "branch already exists", and the comment says to run `/relevo:fix <n>`

#### Scenario: Branch already exists with only the specification
- **WHEN** the feature branch already exists on the remote and holds only the specification commit
- **THEN** `go` leaves it untouched, ends in `qa-failed` with the reason "branch already exists", and the comment says to delete the remote branch and apply `ready` again

#### Scenario: Specification invalid
- **WHEN** the generated change specification still fails validation after two corrections
- **THEN** `go` ends in `qa-failed` with the reason "specification invalid"

#### Scenario: Ambiguity that changes behaviour
- **WHEN** the issue is ambiguous in a way that changes observable behaviour
- **THEN** `go` does not guess: the issue is labelled `needs-spec`, assigned to the spec writer, and nothing is pushed

### Requirement: Safe commits
Every commit `go` makes SHALL stage named files only (never "add all"), scan the staged diff for temporary markers (`NOCOMMIT`, `TEMP`, `DO NOT COMMIT`) and credential patterns, and refuse protected paths. It SHALL stop at the first finding without committing.

#### Scenario: Temporary marker staged
- **WHEN** the staged diff contains `NOCOMMIT`
- **THEN** the commit is aborted and the assignee is told which file

#### Scenario: Credential found before pushing
- **WHEN** the staged diff contains a possible credential
- **THEN** nothing is pushed, the issue is labelled `qa-failed` with that reason, and the comment states that the branch was not pushed

#### Scenario: Protected path staged
- **WHEN** the staged diff touches a protected path the issue does not allow
- **THEN** nothing is committed or pushed and the issue is labelled `qa-failed` with the reason "protected path in the diff"

## ADDED Requirements

### Requirement: The specification is complete before it is validated
After writing the last artifact, `go` SHALL confirm with OpenSpec that every artifact of the change is done. It SHALL NOT validate or build while one is missing.

#### Scenario: All artifacts done
- **WHEN** OpenSpec reports every artifact of the change as done
- **THEN** `go` validates the specification and continues

#### Scenario: An artifact is missing
- **WHEN** OpenSpec reports an artifact that is not done
- **THEN** `go` writes it and checks again; if it is still missing, the run ends in `qa-failed` with the reason "specification incomplete"

### Requirement: The developer starts from the OpenSpec apply instructions
Before the developer agent runs, `go` SHALL obtain the apply instructions of the change from OpenSpec and give the developer its context files and pending tasks. Whether tasks remain SHALL be read from OpenSpec's progress, not counted by hand.

#### Scenario: Pending tasks handed over
- **WHEN** the apply instructions list pending tasks
- **THEN** the developer receives those tasks and the files to read, and does not scan the change for them

#### Scenario: Tasks left after the build
- **WHEN** OpenSpec reports tasks remaining after the developer finished
- **THEN** the run ends in `qa-failed` with the reason "tasks left unfinished"

#### Scenario: Apply is blocked
- **WHEN** the apply instructions report that the change cannot be applied yet
- **THEN** the run ends in `qa-failed` with the reason "specification incomplete"

### Requirement: QA reviews the work in progress
The diff QA reviews SHALL be the difference between the working tree and the base branch, including the developer's new files and excluding generated files. `go` SHALL make new files visible without staging their content, and QA SHALL NOT change the index or any file.

#### Scenario: New file in the diff
- **WHEN** the developer created a file that is not tracked yet
- **THEN** the diff QA reviews contains it

#### Scenario: Generated files
- **WHEN** the work includes generated files such as `*.g.dart` or `*.freezed.dart`
- **THEN** they are not in the diff QA reviews

#### Scenario: Specification commit is not the build
- **WHEN** the specification was committed before the build
- **THEN** the diff QA reviews still shows the developer's uncommitted work against the base branch

### Requirement: QA retries look only at what changed
On a retry, QA SHALL audit the files in the developer's report and every finding of the previous report, and SHALL still run the static analysis and the full test suite.

#### Scenario: Retry scope
- **WHEN** QA runs again after the developer fixed the findings of the first run
- **THEN** QA checks each earlier finding first, reviews the diff of the reported files, and runs analysis and all tests

### Requirement: OpenSpec commands come from a closed list
`go`, `dev` and `qa` SHALL use only the OpenSpec commands on their own list. They SHALL NOT create files under `openspec/changes/` by hand. When an OpenSpec command fails they SHALL show its output and take the failure path, without trying other options.

#### Scenario: Command fails
- **WHEN** an OpenSpec command exits with an error during `go`
- **THEN** its output is shown and the run takes the failure path

#### Scenario: A skill or agent uses a command outside its list
- **WHEN** the text of `go`, `dev` or `qa` names an OpenSpec subcommand that is not on its list
- **THEN** the structure test of the plugin fails

### Requirement: Go checks its environment before changing anything
Before claiming work or creating a branch, `go` SHALL check that the configuration is valid, that OpenSpec runs and finds a root for the repository, and that the working tree is clean. When a check fails it SHALL stop with a clear message and change nothing.

#### Scenario: Invalid configuration
- **WHEN** `relevo.yml` does not validate
- **THEN** `go` shows the validation output and stops

#### Scenario: No OpenSpec root
- **WHEN** OpenSpec reports no root for the repository
- **THEN** `go` stops and tells the person to run `/relevo:doctor`

#### Scenario: Uncommitted changes
- **WHEN** the working tree has uncommitted changes
- **THEN** `go` stops and changes nothing
