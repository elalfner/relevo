# Spec Delta

## MODIFIED Requirements

### Requirement: The progress comment is closed when the run ends
When the run ends, whether it succeeded, failed or was stopped, the progress comment SHALL be replaced by a single line that points to the result, and no progress detail SHALL remain on the issue. This SHALL hold too when the runner of the build is lost and none of the steps of the build job ran after it was lost: the closing SHALL NOT depend on the machine that ran the build.

#### Scenario: Run ends with a result
- **WHEN** the build finishes and the result comment is posted
- **THEN** the progress comment is edited to one line that points to the result

#### Scenario: Run ends without an outcome
- **WHEN** the job ends and the issue is still `building`
- **THEN** the progress comment is closed with a line that says the run ended without an outcome, next to the existing failure report

#### Scenario: The runner of the build is lost
- **WHEN** the build job ends as failed or cancelled and the progress comment is still open because no step of that job could close it
- **THEN** a job that runs on another runner closes it with one line that says the runner stopped answering and the build left no result, and links the run
- **AND** no progress detail (phase, tasks or minutes) remains on the issue

#### Scenario: The close of the build job already ran
- **WHEN** the build job ends as failed or cancelled and its own steps already closed the progress comment
- **THEN** the job that runs afterwards finds it closed and writes nothing

#### Scenario: There is no progress comment
- **WHEN** the build job ends as failed or cancelled and the issue has no progress comment
- **THEN** nothing is created and nothing is edited

#### Scenario: A build that ended in success
- **WHEN** the build job ends in success
- **THEN** the job that runs afterwards does not touch the progress comment

#### Scenario: The labels are not changed
- **WHEN** the progress comment is closed because the runner was lost
- **THEN** the labels of the issue stay as they were and no comment is added

#### Scenario: Closing never fails the run
- **WHEN** GitHub refuses the edit that closes the comment
- **THEN** the job continues and the result of the run does not change
