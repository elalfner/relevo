# Spec Delta

## Purpose

Lets a project say once how deep Relevo works, so that a prototype spends less on effort and questions without ever dropping or weakening a QA lens.

## ADDED Requirements

### Requirement: Depth is a project setting with two values
`relevo.yml` SHALL accept `depth` with the values `prototype` and `standard`. When it is absent the value SHALL be `standard`, which SHALL be what Relevo does without the setting. Depth SHALL NOT be asked per issue, and no command SHALL change it.

#### Scenario: No setting
- **WHEN** `relevo.yml` has no `depth`
- **THEN** every agent and every question of `think` is as before this change

#### Scenario: Unknown value
- **WHEN** `depth` is `deep`
- **THEN** validation fails and lists `prototype` and `standard`

### Requirement: Depth sets defaults, and what the file says wins
`prototype` SHALL lower the default effort of `dev` and of every lens by one step and SHALL allow a lens to default to the lowest model of the lens floor. A value under `agents.*` SHALL win over the depth, and `qa.retries` SHALL keep its own value.

#### Scenario: Prototype defaults
- **WHEN** `depth` is `prototype` and `agents` is not set
- **THEN** `dev` and each lens take one effort step less than the standard default

#### Scenario: Explicit value
- **WHEN** `depth` is `prototype` and `agents.qa.spec.effort` is `high`
- **THEN** the spec lens runs at `high`

### Requirement: No depth removes or weakens a lens
At every depth all five lenses SHALL run, no lens SHALL go below the model floor of the lenses, and the validation gate, the checks of the issue and the protections of the build SHALL be the same.

#### Scenario: Prototype QA
- **WHEN** a build runs with `depth: prototype`
- **THEN** the `spec`, `security`, `code`, `interface` and `bugs` lenses all run and none uses a model below the floor

### Requirement: Think asks fewer questions at the prototype depth
With `depth: prototype`, `/relevo:think` SHALL ask only about what the project and the idea cannot settle, one question at a time, and SHALL state a recommended answer for each. It SHALL still end with every decision of the issue settled.

#### Scenario: Obvious choice
- **WHEN** the code or the project rules already settle a choice
- **THEN** `think` states it as settled and does not ask

#### Scenario: Decision not settled
- **WHEN** a choice that changes the behavior is open
- **THEN** `think` asks it before handing over to `/relevo:issue`
