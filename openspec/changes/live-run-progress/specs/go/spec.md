## ADDED Requirements

### Requirement: A cloud build shows its progress in one comment
While a cloud build runs, `go` SHALL keep one progress comment on the issue, found by a hidden marker and edited in place. It SHALL NOT add a comment for each step or each check. The comment SHALL show the state now and SHALL NOT accumulate history: the phase of the build, the tasks done out of the total and how long the run has lasted, in whole minutes.

#### Scenario: First report
- **WHEN** the build job starts the agent
- **THEN** one progress comment with the marker is created on the issue

#### Scenario: A step finishes
- **WHEN** the number of tasks done or the phase changes
- **THEN** the existing progress comment is edited and no new comment is posted

#### Scenario: Marker already present
- **WHEN** a progress comment with the marker already exists for the issue
- **THEN** it is edited and no second one is created

### Requirement: The phase of the build is announced and checked
At the start of each step of a build, `go` SHALL announce the phase it enters: planning, specification, development, QA, the new attempt of development or QA with its number out of the allowed retries, and delivery. The announcement SHALL be kept outside the working tree of the repository so that it never appears in the diff of the change. When no announcement has been made, the phase SHALL be deduced from what exists in the working tree, and the progress comment SHALL still be kept.

#### Scenario: QA starts
- **WHEN** the agent launches the QA agent for the first time
- **THEN** the progress comment shows the QA phase

#### Scenario: Retry after a rejection
- **WHEN** QA rejects the work and development starts again
- **THEN** the progress comment shows development with its attempt number out of the allowed retries

#### Scenario: No announcement
- **WHEN** the agent has announced no phase
- **THEN** the progress comment shows the phase deduced from the working tree, and the elapsed time keeps growing

#### Scenario: The announcement stays out of the diff
- **WHEN** the phase has been announced and the work is committed
- **THEN** the announcement is not among the files of the commit and the working tree has no file added for it

### Requirement: The workflow signals that the run is alive
Every 30 seconds the workflow SHALL read the announced phase and the tasks done, without depending on the agent, and SHALL edit the progress comment only when the text it would show differs from the text it shows. A run that stops advancing SHALL be recognisable because its elapsed time grows while its tasks and phase do not.

#### Scenario: The agent is silent
- **WHEN** the agent announces nothing and completes no task for several minutes
- **THEN** the elapsed time keeps growing in the progress comment while the tasks and the phase stay as they were

#### Scenario: Nothing changed
- **WHEN** a check finds the same phase, the same tasks and the same minute as the comment already shows
- **THEN** no write is made

#### Scenario: The check stops with the job
- **WHEN** the build job ends, whatever its outcome
- **THEN** no further check is made

### Requirement: The progress comment is closed when the run ends
When the run ends, whether it succeeded, failed or was stopped, the progress comment SHALL be replaced by a single line that points to the result, and no progress detail SHALL remain on the issue.

#### Scenario: Run ends with a result
- **WHEN** the build finishes and the result comment is posted
- **THEN** the progress comment is edited to one line that points to the result

#### Scenario: Run ends without an outcome
- **WHEN** the job ends and the issue is still `building`
- **THEN** the progress comment is closed with a line that says the run ended without an outcome, next to the existing failure report

### Requirement: A closed progress comment is not edited again
Once the progress comment has been closed, no check of the run SHALL edit it, so that a late check cannot replace the closing line with a progress text. The comment SHALL say that it is closed in a way the checks can read before they write.

#### Scenario: A check runs after the closing
- **WHEN** a check finds that the progress comment is closed
- **THEN** it makes no write and the closing line stays as it was

#### Scenario: Closing while a check is running
- **WHEN** the run ends while a check is about to write
- **THEN** the progress comment ends closed, whichever of the two writes came last

### Requirement: Reporting progress never fails the run
Announcing the phase, checking the progress and editing the progress comment SHALL NOT fail the job and SHALL NOT change the outcome of the run. When the progress cannot be read or written, the run SHALL continue and nothing SHALL be reported as failed because of it.

#### Scenario: GitHub refuses the edit
- **WHEN** an edit of the progress comment fails
- **THEN** the build continues and its result is unchanged

#### Scenario: The announcement cannot be written
- **WHEN** the agent cannot write the announcement of a phase
- **THEN** the build continues and the phase is deduced from the working tree
