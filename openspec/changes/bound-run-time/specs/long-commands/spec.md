# Spec Delta

## ADDED Requirements

### Requirement: A long command is cut at the hard stop of the build
A command started through the script in a build SHALL be ended, with the processes it started, when the hard stop of the build passes. Its status SHALL say that the time limit cut it, distinct from `failed` and from `interrupted`, the log SHALL be kept, and no result of a check SHALL be recorded. Outside a build no command is cut.

#### Scenario: The suite is still running
- **WHEN** a test run passes the hard stop
- **THEN** its processes end, the status says it was cut by the time limit, and the gate does not reuse it

#### Scenario: The gate is cut
- **WHEN** the validation gate is cut
- **THEN** `go` does not start it again and takes the failure path with the reason `run limit reached`

#### Scenario: A command started after the hard stop
- **WHEN** a command is started after the hard stop
- **THEN** it does not run and the status says it was cut by the time limit

#### Scenario: Outside a build
- **WHEN** the script is run with no build in progress
- **THEN** the command runs until it ends
