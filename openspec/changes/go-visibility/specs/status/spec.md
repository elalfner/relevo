# Spec Delta

## ADDED Requirements

### Requirement: Status shows the builds of this machine
`status` SHALL list the builds of the repository that are running on the machine where it is run, with the issue, the phase, the group, the tasks done, the minutes and when the progress last changed. It SHALL read them from the state kept beside the worktrees and SHALL NOT interrupt them. It SHALL NOT claim to show the builds of other machines.

#### Scenario: A build running here
- **WHEN** issue 42 is being built on this machine and the person runs `status`
- **THEN** a section shows issue 42 with its phase, "group 2 of 3", its tasks and its minutes

#### Scenario: Nothing running here
- **WHEN** no build of the repository runs on this machine
- **THEN** the section is not shown

#### Scenario: A build on another machine
- **WHEN** issue 43 is `building` with `local` and its state is not on this machine
- **THEN** `status` lists it as an issue being built, without progress
