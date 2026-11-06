# Spec Delta

## ADDED Requirements

### Requirement: The order of the models is declared in relevo.yml
`agents.ladder` SHALL be a list of model names from the lowest to the highest, without repeats, with the default `[haiku, sonnet, opus]`. Relevo SHALL NOT check the names against a list of models, because that list changes; the order is the only thing the ladder says. A ladder that is not a list of distinct non-empty names SHALL be reported by name.

#### Scenario: The default ladder
- **WHEN** `relevo.yml` has no `agents.ladder`
- **THEN** the effective configuration has `[haiku, sonnet, opus]`

#### Scenario: A ladder of the repository
- **WHEN** `agents.ladder` is `[sonnet, opus]`
- **THEN** that order is the one the floor and the ceiling of every role are read against

#### Scenario: An invalid ladder
- **WHEN** `agents.ladder` repeats a name, is empty or holds something that is not a name
- **THEN** the configuration is invalid and the message names `agents.ladder`

### Requirement: A role can be set to auto within a floor and a ceiling
`model` of `agents.dev` and of each lens of `agents.qa` MAY be `auto`, and a role MAY set `floor` and `ceiling`, names of the ladder. A role whose `model` is not `auto` keeps the model written and ignores `floor` and `ceiling`. A floor above the ceiling, or a name that is not in the ladder, SHALL be reported by name.

#### Scenario: A role that is not on auto keeps its model
- **WHEN** `agents.qa.code` is `{ model: sonnet, floor: haiku }`
- **THEN** the effective model of the code lens is `sonnet` and the floor is ignored

#### Scenario: A floor above the ceiling
- **WHEN** a role sets `floor: opus` and `ceiling: sonnet`
- **THEN** the configuration is invalid and the message names the role

#### Scenario: A name outside the ladder
- **WHEN** a role sets `ceiling: gpt-5` and the ladder does not have that name
- **THEN** the configuration is invalid and the message names the role and the ladder

### Requirement: The default range of a role never costs more than the defaults
When a role is on `auto` and sets no `ceiling`, its ceiling SHALL be the default model of the role; when it sets no `floor`, its floor SHALL be the name one step below the ceiling in the ladder, or the ceiling itself when there is none. So `auto` never costs more than the defaults unless the repository raises the ceiling.

#### Scenario: Auto with the defaults
- **WHEN** `agents.dev.model` is `auto` and nothing else is set for the role
- **THEN** its ceiling is `sonnet`, its floor is `haiku`, and the effort is the one configured

#### Scenario: A lens that defaults to the stronger model
- **WHEN** `agents.qa.security.model` is `auto`
- **THEN** its ceiling is `opus` and its floor is `sonnet`: auto never takes the security lens below one step of its default

#### Scenario: The ceiling is raised
- **WHEN** `agents.dev` is `{ model: auto, ceiling: opus }`
- **THEN** the range of the developer is `sonnet` to `opus`

### Requirement: Antigravity accepts auto and does not apply it
With `agent.build: antigravity` the value `auto` and the ladder SHALL be accepted and not applied, like the other settings of the agents.

#### Scenario: With Antigravity
- **WHEN** `agent.build` is `antigravity` and a role is `auto`
- **THEN** the setting is accepted and not applied, with the warning that the other settings of the agents already give
