## MODIFIED Requirements

### Requirement: Doctor reports every check
`doctor` SHALL run every check and give each result one level: pass, fail, warn or note. A failure SHALL come with a fix. A check on something optional, or on something the platform may not offer, SHALL be a warning with its fix and SHALL NOT make `doctor` fail. Information that asks for no action SHALL be a note, which is neither a failure nor a warning.

#### Scenario: A failing check
- **WHEN** a check fails
- **THEN** the report shows the check as failed with the fix next to it

#### Scenario: An optional check
- **WHEN** a check on something optional does not hold
- **THEN** the report shows a warning with its fix, and the exit status stays 0

#### Scenario: Information with no action
- **WHEN** `doctor` has something to tell that asks the person for nothing, such as a reminder to read the terms of a subscription token
- **THEN** the report shows it as a note, and it counts neither as a failure nor as a warning

### Requirement: Doctor checks the runner of the workflows
`doctor` SHALL compare the `runs-on` of each Relevo workflow on the default branch with `runner.labels` and SHALL fail on a difference, with one result that names every file that differs and the fix. When the runner is not `ubuntu-latest`, it SHALL warn once that Relevo assumes the runner persists between jobs, that the code the agent writes runs with the permissions of the runner's user, and that an ephemeral runner or a container is the real barrier. It SHALL NOT claim to know whether the runner is ephemeral.

#### Scenario: A workflow edited by hand
- **WHEN** `relevo.yml` has no `runner` key and `relevo-go.yml` on the default branch runs on `[self-hosted, linux-build]`
- **THEN** `doctor` fails, names `relevo-go.yml` and says to set `runner.labels` or restore `ubuntu-latest`

#### Scenario: Several workflows differ
- **WHEN** five Relevo workflows run on `[self-hosted, linux-build]` and `runner.labels` is absent
- **THEN** `doctor` reports one failed result that names the five files, with one fix

#### Scenario: Workflows and setting agree
- **WHEN** every Relevo workflow runs on `[self-hosted, linux-build]` and `runner.labels` is `[self-hosted, linux-build]`
- **THEN** the runner check passes and one warning explains that the runner is assumed to persist

#### Scenario: Hosted runner
- **WHEN** `runner.labels` is absent and every workflow runs on `ubuntu-latest`
- **THEN** the runner check passes and no persistence warning appears

## ADDED Requirements

### Requirement: The report puts what needs action first
The text report SHALL list the failures, then the warnings, then the notes, each section with its count, and SHALL show the checks that passed only as a count. With `--all` it SHALL list every check in the order it was evaluated. The exit status and the output of `--json` SHALL NOT depend on the layout.

#### Scenario: A report with problems
- **WHEN** `doctor` finds 3 failures, 2 warnings, 1 note and 30 passes
- **THEN** the report lists the 3 failures, then the 2 warnings, then the note, and ends with a line that says 30 checks passed

#### Scenario: The full list
- **WHEN** `doctor --all` runs
- **THEN** every check appears, passes included, in the order it was evaluated

#### Scenario: All green
- **WHEN** no check failed or warned
- **THEN** the report says so, gives the count of checks that passed and lists any notes

#### Scenario: The machine-readable output
- **WHEN** `doctor --json` runs, with or without `--all`
- **THEN** it lists every check with its level, notes included, and the exit status is 1 only when a check failed

### Requirement: The report says what it judged
The report SHALL start with a line that names the repository and says where the workflows were read from: the default branch, named, or the working copy when the branch could not be read.

#### Scenario: Workflows read from the default branch
- **WHEN** `doctor` reads the workflows from the default branch `main` of `owner/repo`
- **THEN** the first line names `owner/repo` and the branch `main`

#### Scenario: The branch cannot be read
- **WHEN** the default branch cannot be read and `doctor` falls back to the working copy
- **THEN** the first line says that the workflows were read from the working copy

### Requirement: One result per cause
When several files fail or warn for the same reason with the same fix, `doctor` SHALL report them as one result that names every file. The summary SHALL count results, not files.

#### Scenario: Two causes
- **WHEN** five workflows fail the runner check and two labels are missing
- **THEN** the report lists two failures and the summary says 2 checks failed

#### Scenario: Workflows that are not installed
- **WHEN** two Relevo workflows are not installed
- **THEN** the report shows one warning that names both files and gives one fix
