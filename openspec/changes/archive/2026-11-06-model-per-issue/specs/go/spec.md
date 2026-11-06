# Spec Delta

## ADDED Requirements

### Requirement: The model plan is made by a script before the first launch
Before it launches the developer, `go` SHALL run the model plan, a script that prints for each role the model, the effort, the source of the choice (`config`, `auto` or `issue`) and the reason. `go` SHALL launch every agent with the model and the effort of the plan, and SHALL NOT choose a model itself. The plan SHALL be the same for the same inputs.

#### Scenario: A small issue with the developer on auto
- **WHEN** `agents.dev.model` is `auto`, the change has 3 tasks and 5 scenarios, and nothing in the issue is sensitive
- **THEN** the plan gives the developer the floor of its range and says the issue is small

#### Scenario: A large issue
- **WHEN** the change has 20 tasks and scenarios together
- **THEN** the plan gives the developer the ceiling of its range

#### Scenario: A role that is not on auto
- **WHEN** `agents.qa.code.model` is `sonnet`
- **THEN** the plan gives the code lens `sonnet` with the source `config`, whatever the issue says

### Requirement: The plan fails open
When the model plan cannot be made, `go` SHALL launch every agent with the model and the effort of the configuration and SHALL say so in its report. An error of the plan SHALL NOT stop or fail a build.

#### Scenario: The plan cannot be made
- **WHEN** the script fails or prints something that is not a plan
- **THEN** `go` launches every agent with the model and the effort of the configuration and says so in its report

### Requirement: The plan scores the size of the change and two raises
For a role on `auto`, the plan SHALL place the model in the range of the role by the size of the change (tasks plus scenarios: up to 6 takes the floor, up to 14 the middle rounded up, more the ceiling). It SHALL raise the pick one step, up to the ceiling, when the issue lists a dependency file in `Allow-paths:` or names a security-sensitive area, and the security lens SHALL go to the ceiling in both cases. With nothing to score, it SHALL use the default model of the role and SAY so.

#### Scenario: A security-sensitive issue
- **WHEN** the issue mentions an authentication or a credential and the security lens is on `auto`
- **THEN** the security lens runs on its ceiling

#### Scenario: Too few signals
- **WHEN** the change has no tasks and no scenarios
- **THEN** every role on `auto` uses the default model of the role and the reason says there was nothing to score

### Requirement: What the issue asks for is clamped
The issue MAY carry `Model:` for the developer and `QA-model:` for the lenses. For a role on `auto`, the plan SHALL use the value, SHALL NOT go above the ceiling of the role, and MAY go below its floor. It SHALL ignore the value, and say why in the plan, when `trust` is `public` or the name is not in the ladder.

#### Scenario: The issue asks for a lower model
- **WHEN** the issue says `Model: haiku` and the developer is on `auto` with the ceiling `sonnet`
- **THEN** the developer runs on `haiku` with the source `issue`

#### Scenario: The issue asks for a model above the ceiling
- **WHEN** the issue says `Model: opus` and the ceiling of the developer is `sonnet`
- **THEN** the developer runs on `sonnet` and the plan says the value was clamped to the ceiling

#### Scenario: Public trust
- **WHEN** `trust` is `public` and the issue carries `Model: haiku`
- **THEN** the line is ignored and the plan says why

#### Scenario: A name the ladder does not have
- **WHEN** the issue says `Model: gpt-5`
- **THEN** the line is ignored and the plan names the value and the ladder

### Requirement: The plan never raises the cost limit
The model plan SHALL NOT change `limits.run_max_cost`, `limits.run_max_turns` or `limits.run_max_minutes`, and no value of the issue SHALL bypass them.

#### Scenario: A cheaper plan
- **WHEN** the plan lowers the models of a small issue
- **THEN** the limits of the run are the ones in `relevo.yml`

#### Scenario: A line in the issue
- **WHEN** the issue says `Model: opus` and the ceiling allows it
- **THEN** the run is still stopped by `limits.run_max_cost`
