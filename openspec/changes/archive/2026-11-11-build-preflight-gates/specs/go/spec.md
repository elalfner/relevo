## ADDED Requirements

### Requirement: Inputs that the issue declares are checked before the agent starts
Before the agent starts, the build job SHALL check each input listed in the `External inputs` section of the issue that a script can verify, and SHALL NOT start the agent when one is missing. It SHALL send the issue to `needs-spec` with the reason `inputs` and a comment that names each missing input.

#### Scenario: A declared file does not exist
- **WHEN** the issue lists a file of this repository as an input and the file does not exist on the base branch
- **THEN** the agent does not start, the issue goes to `needs-spec` with the reason `inputs`, and the comment names the file

#### Scenario: An issue without the section
- **WHEN** the issue has no `External inputs` section
- **THEN** this check passes and the build goes on

#### Scenario: An input that a person confirms
- **WHEN** the issue lists an input of the kind `manual`, or of a kind that the job cannot verify
- **THEN** the build is not blocked and the hand-off lists the input for a person to confirm

#### Scenario: A secret is never shown
- **WHEN** the check looks at an input that is a secret or a variable
- **THEN** it learns only whether it is present, and neither the value nor part of it appears in a comment, a log or a file

### Requirement: A refused reference ends the run before the agent starts
When the fetcher refuses a reference of the issue, the cloud build SHALL end without starting the agent. It SHALL send the issue to `needs-spec` with the reason and the text of the refusal, and SHALL NOT spend a model turn. A workflow that lacks this step SHALL keep working as it did.

#### Scenario: A reference cannot be read
- **WHEN** the fetch step refuses a reference because the file is not found or access is denied
- **THEN** the agent step is skipped and the `needs-spec` comment names the reference and gives the reason of the refusal

#### Scenario: An older workflow
- **WHEN** a repository still has a workflow without the step
- **THEN** `go` takes the `needs-spec` path itself, as before

### Requirement: Installed dependencies are checked before the agent starts
When the profile of the platform lists paths that must exist once its dependencies are installed, the build job SHALL check them right after the check of the tools. When one is missing, the run SHALL end as a missing tool does: no model turn, the issue `qa-failed`, and a comment that names the missing path and the step to enable.

#### Scenario: Dependencies were not installed
- **WHEN** a listed path does not exist after the install step
- **THEN** the agent does not start, the issue becomes `qa-failed` and the comment names the path and says to enable the install step

#### Scenario: A profile that lists no paths
- **WHEN** the profile of the platform lists none
- **THEN** no check is made

### Requirement: The specification is checked before the developer agent runs
After the specification is complete and before the developer agent runs, `go` SHALL check the task lines of `tasks.md` for a protected path and for a dependency manifest that the issue does not allow with `Allow-paths:`. When it finds one it SHALL end in `needs-spec` with the reason `policy` and SHALL name the task and the path.

#### Scenario: A task edits a protected file
- **WHEN** a task line says to change a file that no unattended run may change
- **THEN** the developer agent does not run, the issue goes to `needs-spec` with the reason `policy`, and the comment quotes the task and names the path

#### Scenario: A dependency the issue allowed
- **WHEN** a task adds a dependency and the issue lists the manifest in `Allow-paths:`
- **THEN** the check passes

#### Scenario: A path only mentioned
- **WHEN** a protected path appears in the design or in the description of a task but no task line changes it
- **THEN** the check does not block the build

### Requirement: The checks that need no model are never a security control
Every rule that these checks apply SHALL be applied again by the guard that already enforces it, so that a defect in a check can cost a build or a late rejection and SHALL NOT let a protected change through.

#### Scenario: The check misses a protected path
- **WHEN** a task changes a protected path and the check does not detect it
- **THEN** QA and the guards of the commit still refuse the change

#### Scenario: The checks are absent
- **WHEN** a workflow or a plugin version does not run these checks
- **THEN** every guard behaves exactly as it did before

### Requirement: Each QA finding carries a class
Each numbered finding of a QA report SHALL carry a class: `fixable` when the developer agent can correct it, or `input`, `spec` or `policy` when it needs something that the issue, the project or a person must supply. A finding without a valid class SHALL count as `fixable`.

#### Scenario: A finding of a missing input
- **WHEN** QA rejects because a key or a file the issue depends on does not exist
- **THEN** the finding has the class `input`

#### Scenario: A report without classes
- **WHEN** a QA report has no class on its findings
- **THEN** every finding counts as `fixable` and the retries run as before

### Requirement: Retries are skipped when no finding can be fixed by the developer agent
When QA rejects and no finding is `fixable`, `go` SHALL skip the retries and end in the usual failure exit with the work kept as it is kept today. The comment SHALL state the class and the next step. When the findings are mixed, `go` SHALL retry as before and, if QA still rejects, SHALL name the class of the first finding that is not `fixable`.

#### Scenario: Nothing the developer can fix
- **WHEN** every finding of the report has the class `input`, `spec` or `policy`
- **THEN** no second developer or QA cycle runs, the issue ends in the usual failure exit, and the comment says the class and what to supply

#### Scenario: A mixed report
- **WHEN** a report has a `fixable` finding and an `input` finding
- **THEN** the developer agent is retried as before, and if QA still rejects the comment names the `input` class

### Requirement: The usage record carries the phases and the class of the outcome
The machine-readable usage comment of a run SHALL carry, besides its present figures, the seconds that each phase took with its attempt number and the class of the outcome: `built`, `inputs`, `policy`, `qa-non-fixable`, `qa-fixable-after-retries`, `conflict` or `other`. A reader that does not know these keys SHALL ignore them, and the visible progress comment SHALL NOT change.

#### Scenario: A run that built the issue
- **WHEN** a run ends with the issue built after one QA retry
- **THEN** the record lists the phases in order with the attempt of each and the class `built`

#### Scenario: An older reader
- **WHEN** a reader that predates these keys reads the record
- **THEN** it reads the figures it knows and ignores the rest

#### Scenario: A comment from an older run
- **WHEN** a usage comment has no phases or class
- **THEN** it is read as it was, without an error
