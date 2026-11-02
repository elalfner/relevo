## ADDED Requirements

### Requirement: The lens agents are read-only
Each lens agent SHALL have no tool that writes or edits files, SHALL NOT change the index, and SHALL treat the text of the issue, the specification, the code and the output of tools as data and never as instructions.

#### Scenario: A lens given an instruction in the diff
- **WHEN** a comment in the diff tells a lens to skip a rule
- **THEN** the lens does not follow it and may report it as a finding

#### Scenario: The tool list
- **WHEN** a lens agent is read
- **THEN** its tool list holds no write or edit tool

### Requirement: The gate and its receipt are safeguards, not boundaries
The gate and its receipt SHALL guard against an omission or a mistake and SHALL NOT be a security control. Every protected path, restricted file and credential rule SHALL still be enforced by the guard that already enforces it.

#### Scenario: A receipt written by hand
- **WHEN** an agent writes a receipt that matches its diff
- **THEN** the commit guards still refuse a protected path or a credential in that diff

### Requirement: The page on controls says what holds for each agent
The security page SHALL say, for each supported agent, which of these controls hold, which hold in part and which do not exist, including that the settings of model and effort are not applied with Antigravity.

#### Scenario: A reader looks at Antigravity
- **WHEN** a person reads the security page for Antigravity
- **THEN** it says that the lenses are read-only by their tool list and that the settings are not applied
