# project-depth Specification

## Purpose
Lets a project say once how deep Relevo works, so that a prototype spends less on effort and questions without ever dropping or weakening a QA lens.

## Requirements

### Requirement: Depth is a project setting with two values
`relevo.yml` SHALL accept `depth` with the values `prototype` and `standard`. When it is absent the value SHALL be `standard`, which SHALL be what Relevo does without the setting. Depth SHALL NOT be asked per issue, and no command SHALL change it.

#### Scenario: No setting
- **WHEN** `relevo.yml` has no `depth`
- **THEN** every agent and every question of `think` is as before this change

#### Scenario: Unknown value
- **WHEN** `depth` is `deep`
- **THEN** validation fails and lists `prototype` and `standard`

### Requirement: Depth sets defaults, and what the file says wins
For Claude Code, `prototype` SHALL lower the default effort of `dev` and of every lens by one step and SHALL allow a lens to default to the lowest model of the lens floor (`sonnet`). For Antigravity, `prototype` SHALL lower `agents.main.effort` by one step (from `high` to `medium`) while keeping `dev` and all five QA lenses (`spec`, `security`, `code`, `interface`, `bugs`) on `inherit` so every subagent runs on the main flagship model at `medium` rather than downgrading to `gemini-4-hydrogen-*`. A value written under `agents.*` (or `agents.<tool>.*`) SHALL win over the depth, and `qa.retries` SHALL keep its own value.

#### Scenario: Prototype defaults
- **WHEN** `agent.build` is `claude`, `depth` is `prototype`, and `agents` is not set
- **THEN** `dev` and each lens take one effort step less than the standard Claude default, and `spec` and `security` default to `sonnet`

#### Scenario: Prototype defaults for Antigravity
- **WHEN** `agent.build` is `antigravity`, `depth` is `prototype`, and `agents` is not set
- **THEN** `agents.main` is `{ model: gemini-4-neon, effort: medium }` while `dev` and all five QA lenses remain on `inherit`

#### Scenario: Explicit value
- **WHEN** `depth` is `prototype` and `agents.qa.spec.effort` is `high` (for Claude) or `agents.antigravity.main.effort` is `high` (for Antigravity)
- **THEN** the explicit value wins over the prototype default

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
