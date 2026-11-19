## MODIFIED Requirements

### Requirement: Every lens agent renders with a valid name
The renderer SHALL write the five lens agents with the names `relevo-qa-spec`, `relevo-qa-security`, `relevo-qa-code`, `relevo-qa-interface` and `relevo-qa-bugs`, SHALL rewrite every reference to them in the skills, and a test SHALL fail when an agent file of the plugin renders to an invalid name.

#### Scenario: Rendering the lenses
- **WHEN** the Antigravity renderer runs
- **THEN** the five lens agents are written with those names and no `relevo:qa-` token remains

#### Scenario: A new agent file
- **WHEN** an agent file is added to the plugin
- **THEN** the test checks that it renders to a valid name
