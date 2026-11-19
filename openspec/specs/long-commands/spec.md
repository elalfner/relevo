# long-commands Specification

## Purpose
Runs a command that takes minutes in the background through one script, with a log, a status the agent can poll cheaply and a bounded wait, so that it does not depend on the foreground limit of the agent's tool, and records the result of a profile check for the validation gate to reuse.

## Requirements

### Requirement: A long command runs in the background through one script
A script SHALL run a command in the background, detached from the tool that started it, with a log and a status, so that a command that takes minutes does not depend on the foreground limit of the agent's tool. Starting returns at once. A status request SHALL answer in one line that says whether the command is running, passed, failed (with its exit code) or was interrupted. A wait request SHALL return before a bounded number of seconds, shorter than that limit, whether or not the command finished.

#### Scenario: A command that takes minutes
- **WHEN** the developer or the gate needs a command that takes minutes
- **THEN** the script starts it in the background and returns, and a later status or wait says whether it finished

#### Scenario: Polling is cheap
- **WHEN** the agent asks for the status of a running command
- **THEN** one short line answers, with the elapsed seconds and the last line of the log

#### Scenario: A wait is bounded
- **WHEN** the agent waits for a command that has not finished
- **THEN** the script returns "running" before the bound, and the agent can wait again

### Requirement: The log survives the job
The output of the command SHALL be written to the log by the operating system, not through the script, so that when the script or the job is killed the log stays readable and the status says `interrupted`.

#### Scenario: The job is killed
- **WHEN** the script is killed while the command runs
- **THEN** the log keeps what was written and the status is `interrupted`

### Requirement: A profile check runs by name and is recorded only after it ran
The script SHALL run a check of the profile (`analyze` or `test`) by name, taking the command from the profile and not from the caller. When the check ends with exit 0 and the diff did not change while it ran, the script SHALL record the result for the gate. A failure SHALL be recorded as a failure. No argument of any script SHALL record a result without running the command.

#### Scenario: The developer runs the suite
- **WHEN** the developer starts the `test` check and it passes on an unchanged diff
- **THEN** the gate that follows finds the result and does not run the suite again

#### Scenario: The agent cannot name the command
- **WHEN** the check is started by name
- **THEN** the command that runs is the one of the profile

#### Scenario: The tree changes during the run
- **WHEN** the diff changes while the check runs
- **THEN** nothing is recorded as reusable

### Requirement: The run folder is local and ignored
The state of a run SHALL live in a local folder that git ignores and SHALL NOT appear in the diff or in a commit.

#### Scenario: A run leaves files
- **WHEN** a long command ran
- **THEN** its log and status are not among the files of a commit
