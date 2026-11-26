# Spec Delta

## ADDED Requirements

### Requirement: The progress shows the group in progress
The progress of a build, in the comment of a cloud build and in the lines of a local one, SHALL show the group in progress out of the groups of the run. The numbers SHALL be recorded by the scripts that split the tasks into groups and that commit the checkpoint of each group. `go` SHALL announce nothing for it and no turn SHALL be added.

#### Scenario: Second group of three
- **WHEN** the first checkpoint of a run with three groups was committed and the developer works on the next group
- **THEN** the progress shows "group 2 of 3"

#### Scenario: One group
- **WHEN** the change is built as one group
- **THEN** the progress shows "group 1 of 1"

#### Scenario: A resumed run
- **WHEN** a run resumes with two groups still pending
- **THEN** the progress counts the groups of this run, from 1 of 2

#### Scenario: The numbers cannot be recorded
- **WHEN** the progress folder cannot be written
- **THEN** the checkpoint is made as today and the progress shows no group

### Requirement: Every launch of the developer is explicit and named
`go` SHALL launch the developer agent, in every mode, as one call in the foreground, SHALL NOT start it in the background and SHALL NOT end its turn while it runs. The launch of a group SHALL carry a description that names the group and its tasks (`build 2/3: 2.1, 2.2`), and the launch of a correction a description that names its attempt. The usage comment SHALL show that description with the entry of the launch.

#### Scenario: Launch of a group
- **WHEN** `go` launches the developer for the second of three groups, with tasks 2.1 and 2.2
- **THEN** the launch is one foreground call whose description is `build 2/3: 2.1, 2.2`

#### Scenario: Usage of a run with three groups
- **WHEN** the usage comment of that run lists its agents
- **THEN** the three launches of the developer are told apart by their descriptions

#### Scenario: A replica
- **WHEN** `go` launches a replica
- **THEN** its description stays `replica <task id>`, as today

### Requirement: Unmarked tasks are found at their group
After each group, the script that commits its checkpoint SHALL also say which tasks of that group are still unmarked in `tasks.md`. A task the developer reported it could not finish SHALL be handled as an open question, at that group. For the others `go` SHALL launch the developer once more, for those tasks alone; if any is still unmarked afterwards, the run SHALL take the failure path with the reason `tasks left unfinished` without building the later groups.

#### Scenario: Every task marked
- **WHEN** the tasks of the group are all marked
- **THEN** the checkpoint is made and the next group starts

#### Scenario: Unmarked with no reason given
- **WHEN** task 2.2 is unmarked and the report of the developer has no open question
- **THEN** the developer is launched once more with task 2.2 alone

#### Scenario: Still unmarked
- **WHEN** task 2.2 is still unmarked after that launch
- **THEN** the run ends with `tasks left unfinished`, the work is kept, and group 3 is not built

#### Scenario: Unmarked with a reason
- **WHEN** the developer reported that task 2.2 cannot be done as specified
- **THEN** the developer is not launched again for it, and the report is handled as an open question
