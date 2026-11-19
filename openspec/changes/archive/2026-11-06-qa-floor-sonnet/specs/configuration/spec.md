## MODIFIED Requirements

### Requirement: The default range of a role never costs more than the defaults
When a role is on `auto` and sets no `ceiling`, its ceiling SHALL be the default model of the role; when it sets no `floor`, its floor SHALL be the name one step below the ceiling in the ladder, or the ceiling itself when there is none. For a QA lens the default floor SHALL NOT be below `sonnet` when `sonnet` is in the ladder: it is the higher of the name one step below the ceiling and `sonnet`, and never above the ceiling. So `auto` never costs more than the defaults unless the repository raises the ceiling, and a QA lens is never taken to a model that the lens evaluation did not pass.

#### Scenario: Auto with the defaults
- **WHEN** `agents.dev.model` is `auto` and nothing else is set for the role
- **THEN** its ceiling is `sonnet`, its floor is `haiku`, and the effort is the one configured

#### Scenario: A lens that defaults to the stronger model
- **WHEN** `agents.qa.security.model` is `auto`
- **THEN** its ceiling is `opus` and its floor is `sonnet`: auto never takes the security lens below one step of its default

#### Scenario: A lens that defaults to sonnet
- **WHEN** `agents.qa.code.model` or `agents.qa.interface.model` is `auto` and nothing else is set for the lens
- **THEN** its ceiling and its floor are `sonnet`: the lens evaluation did not pass haiku for these lenses

#### Scenario: A floor written for a lens
- **WHEN** `agents.qa.code` is `{ model: auto, floor: haiku }`
- **THEN** its floor is `haiku`: only the default is raised

#### Scenario: The ceiling is raised
- **WHEN** `agents.dev` is `{ model: auto, ceiling: opus }`
- **THEN** the range of the developer is `sonnet` to `opus`
