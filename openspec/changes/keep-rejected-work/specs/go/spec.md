# Spec Delta

## MODIFIED Requirements

### Requirement: Unrecoverable problems end in qa-failed
Any problem `go` cannot recover from SHALL end in the `qa-failed` exit with a stated reason, and SHALL push the branch except when the reason is a possible credential, a temporary marker, a protected path in the diff or an issue that changed after `ready`, or when the branch already exists, which `go` never touches. When the reason is that QA rejected the work after the retries or that tasks were left unfinished, `go` SHALL first commit the work in progress, through the same safe commit as a successful build and with a message that says it is not approved, so that the push keeps it; if that commit is refused, `go` SHALL push nothing. It SHALL NOT open a pull request or advance the state.

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

#### Scenario: QA rejects after the retries
- **WHEN** QA still rejects the work after the retries and the safe commit accepts it
- **THEN** the branch is pushed with a commit `wip: rejected by QA (#<n>)` that holds the work, the issue is `qa-failed`, no pull request is opened, and the comment says the branch holds work that QA did not approve

#### Scenario: QA could not run the checks
- **WHEN** QA rejected only because the analysis and the tests could not run
- **THEN** the work is kept in the same way and the comment says what QA could not check

#### Scenario: Tasks left unfinished
- **WHEN** the developer finished with tasks still open
- **THEN** the work done is committed and pushed as work in progress, and the comment says how many tasks are done

#### Scenario: The safe commit refuses the work
- **WHEN** the work in progress contains a protected path, a file outside the platform, a temporary marker or a possible credential
- **THEN** nothing is committed or pushed, and the comment says the branch was not pushed and why
