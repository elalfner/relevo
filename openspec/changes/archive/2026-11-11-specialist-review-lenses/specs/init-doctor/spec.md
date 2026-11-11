## ADDED Requirements

### Requirement: `doctor` and `init` warn about settings that the agent does not apply
When the agent in use does not apply a setting of `agents`, `doctor` and `init` SHALL print a warning that names each setting and says it is not applied, and SHALL NOT fail for it.

#### Scenario: Antigravity
- **WHEN** `agent.build` is `antigravity` and the file sets an agent setting
- **THEN** `doctor` and `init` warn that it is not applied and go on

#### Scenario: Claude with every setting applied
- **WHEN** the agent applies every setting of the file
- **THEN** no warning is printed

### Requirement: `doctor` checks that the lens agents are in place
`doctor` SHALL check that the plugin has the four lens agents and that the profile of each platform can be resolved for each lens, and SHALL report a missing agent or a profile that cannot be resolved.

#### Scenario: A plugin without a lens agent
- **WHEN** an installed plugin lacks `qa-security`
- **THEN** `doctor` names it and says to update the plugin

### Requirement: `doctor` reports a leftover reference to the former QA agent
`doctor` SHALL report a profile, a workflow or a rules file of the repository that still names the agent `relevo:qa`, and SHALL say to use the lens agents.

#### Scenario: A stale reference
- **WHEN** a file of the repository names `relevo:qa`
- **THEN** `doctor` reports the file and says what replaced it
