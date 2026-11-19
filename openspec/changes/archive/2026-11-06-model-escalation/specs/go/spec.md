## ADDED Requirements

### Requirement: A retry of the developer runs one level up
Before each launch of the developer in fix mode after a red gate or a rejection, `go` SHALL ask `scripts/model-plan.mjs escalate` for its model. For a developer on `auto` the script SHALL give the next name of `agents.ladder` after the model of the failed attempt, never past the `ceiling` of the role. In every other case it SHALL give the same model back. The lenses SHALL keep the model of the plan, and no limit of the run SHALL change.

#### Scenario: QA rejects and the developer is on auto
- **WHEN** the attempt 1 ran on `haiku`, QA rejected it and the ceiling of the developer is `opus`
- **THEN** the retry runs on `sonnet`, and a second retry would run on `opus`

#### Scenario: The developer is at its ceiling
- **WHEN** the developer already runs on its ceiling and QA rejects the attempt
- **THEN** the retry runs on the same model

#### Scenario: The model of the developer is set in the configuration
- **WHEN** `agents.dev.model` is a name and not `auto`
- **THEN** the retry runs on that name

#### Scenario: The red gate
- **WHEN** the gate is red on an attempt that is not the last one
- **THEN** the retry runs one name up, as after a rejection

#### Scenario: The step cannot be made
- **WHEN** the configuration cannot be read or the model is not in the ladder
- **THEN** the retry runs on the model of the failed attempt and the run goes on
