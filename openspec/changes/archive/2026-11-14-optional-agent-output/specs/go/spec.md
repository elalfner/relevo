## ADDED Requirements

### Requirement: The agent output of a run can be shown, redacted
The cloud workflow SHALL be able to print the output of the agent in the log of the run, but only when the full output is on for that run, and it SHALL print a redacted rendering of the runner's execution log after the agent step ends. It SHALL NOT pass the action's `show_full_output` input, whose output is printed as it happens and cannot be redacted. The output SHALL be on for a run when `run.full_output` is true in `relevo.yml` or when the run was started by hand with its `full_output` input true, and SHALL be off otherwise.

#### Scenario: Output off
- **WHEN** neither `run.full_output` nor the `full_output` input is true
- **THEN** the log has no rendering of the agent's tool calls or results

#### Scenario: Output turned on for one run
- **WHEN** a person starts the workflow by hand with `full_output` true and `relevo.yml` does not set `run.full_output`
- **THEN** the log of that run has the redacted rendering and the next run does not

#### Scenario: Output turned on for the repository
- **WHEN** `run.full_output` is true and `trust` is not `public`
- **THEN** every run prints the redacted rendering after its agent step

#### Scenario: The rendering is printed even when the run fails
- **WHEN** the agent step is cancelled, times out or fails and the output is on
- **THEN** the rendering of whatever the execution log holds is still printed

### Requirement: A run that ends abnormally leaves a trimmed transcript
When a run ends cancelled, timed out or without an outcome, and `trust` is not `public`, the workflow SHALL save the last part of what the agent did as a workflow artifact and SHALL link it in the comment that reports the run. The transcript SHALL hold the commands of the agent, redacted. When the full output is on, it SHALL also hold the first part of each result, redacted. When the full output is off, no result SHALL be kept. A run that ends with an outcome SHALL NOT save a transcript.

#### Scenario: Run cancelled at the time limit
- **WHEN** the job reaches its timeout with the output off
- **THEN** an artifact holds the last commands of the agent, redacted and with no results, and the comment on the issue links it

#### Scenario: Output on
- **WHEN** a run ends without an outcome and the full output is on
- **THEN** the artifact also holds a short, redacted excerpt of each result

#### Scenario: Run with an outcome
- **WHEN** the run ends with `built` or `qa-failed` through the skill's own exit
- **THEN** no transcript is saved

#### Scenario: The log is missing
- **WHEN** the execution log does not exist or has no entries the reader understands
- **THEN** no artifact is saved, the comment says there was no transcript, and the step does not fail the job

### Requirement: The transcript steps never change the outcome of a run
The step that prints the rendering and the step that saves the transcript SHALL run whatever the result of the agent step, SHALL NOT fail the job, and SHALL NOT change a label or the outcome that the run recorded.

#### Scenario: Unreadable log
- **WHEN** the execution log cannot be parsed
- **THEN** both steps end successfully with a notice in the log
