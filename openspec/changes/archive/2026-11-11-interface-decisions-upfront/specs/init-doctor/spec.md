## ADDED Requirements

### Requirement: `doctor` notes when previews cannot be checked
For a platform whose stack has an interface, `doctor` SHALL note that the automatic check of previews will be skipped when no browser automation library is available to the platform or to the machine, and SHALL say how to enable it. It SHALL NOT fail for it.

#### Scenario: No browser automation
- **WHEN** a platform of the `vue` stack has no browser automation library and the machine has none
- **THEN** `doctor` notes that previews will not be checked and says how to enable the check

#### Scenario: A stack with no interface
- **WHEN** the stack of the platform has no interface
- **THEN** `doctor` says nothing about it

### Requirement: `doctor` validates the files of the interface knowledge
`doctor` SHALL validate `.relevo/interface.json` when it exists, reporting a rule with a missing field, a repeated identifier, or an attempt to lower the weight of a rule of the plugin, and SHALL check that the paths of `design.system` exist.

#### Scenario: A rule with a missing field
- **WHEN** a rule of `.relevo/interface.json` has no weight
- **THEN** `doctor` reports the rule and the field

#### Scenario: A declared path that does not exist
- **WHEN** `design.system.tokens` lists a folder that is not in the repository
- **THEN** `doctor` reports the path
