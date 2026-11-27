# Spec Delta

## ADDED Requirements

### Requirement: A build has a hard stop for what is already running
A build with a progress folder SHALL have a hard stop at `limits.run_max_minutes` plus 10 minutes, counted as the limit is. In a cloud build it SHALL be no later than 5 minutes before the `timeout-minutes` of the build job, when the installed workflow lets that be read. No setting changes the margin.

#### Scenario: Default values
- **WHEN** a cloud build runs with `limits.run_max_minutes` 50 in a job with `timeout-minutes: 60`
- **THEN** the hard stop is 55 minutes after the start of the job

#### Scenario: A build on a machine
- **WHEN** a local build runs with `limits.run_max_minutes` 50
- **THEN** the hard stop is 60 minutes after the run entered `planning`

#### Scenario: The job timeout cannot be read
- **WHEN** the build job has no readable `timeout-minutes`
- **THEN** the hard stop is the limit plus the margin

### Requirement: A subagent past the hard stop is made to end
After the hard stop, a tool call of a subagent of the build SHALL be refused with a reason that says that the time limit passed and asks for the final report now. The tool calls of the orchestrator, other than the launch of an agent, SHALL NOT be refused, so that it can keep the work and report.

#### Scenario: The developer is still working
- **WHEN** the developer agent calls a tool after the hard stop
- **THEN** the call is refused with that reason

#### Scenario: Between the limit and the hard stop
- **WHEN** a subagent calls a tool after the limit and before the hard stop
- **THEN** the call is allowed

#### Scenario: The work is kept afterwards
- **WHEN** a subagent ends because of the hard stop
- **THEN** `go` takes the failure path with the reason `run limit reached`, keeps the work, and does not treat the cut report as a defect of the specification

#### Scenario: The comment says what was cut
- **WHEN** the run stops after something was cut
- **THEN** the finding gives the minutes that passed and names what was cut and what did not run

### Requirement: An agent launch after the limit is refused
In a build with a progress folder, the launch of a Relevo agent after `limits.run_max_minutes` SHALL be refused even when the orchestrator did not ask the budget guard.

#### Scenario: The check was skipped
- **WHEN** the orchestrator launches a Relevo agent after the limit without asking the guard
- **THEN** the launch is refused with a reason that names the limit

### Requirement: The time guard acts only inside a running build
The time guard SHALL do nothing in a session that is not a build in progress, and SHALL allow the call when it cannot read its inputs. An error of the guard SHALL NOT fail or stop a run.

#### Scenario: An ordinary session
- **WHEN** a person with the plugin enabled uses tools outside a build
- **THEN** no call is refused or changed

#### Scenario: A build that already ended
- **WHEN** the build has recorded how it ended and a tool is called in its folder
- **THEN** no call is refused

#### Scenario: Unreadable state
- **WHEN** the state of the build is missing or cannot be read
- **THEN** the call is allowed
