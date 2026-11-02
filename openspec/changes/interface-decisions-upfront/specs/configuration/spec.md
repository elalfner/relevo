## ADDED Requirements

### Requirement: The design system can be declared
`relevo.yml` MAY declare `design.system.tokens`, `design.system.components` and `design.system.references`, each a list of paths inside the repository. The configuration SHALL fail a path that does not exist, leaves the repository, or is restricted or protected, and SHALL accept a file without these keys.

#### Scenario: Declared paths
- **WHEN** the keys list folders that exist in the repository
- **THEN** the configuration is valid and the interface step reads those paths

#### Scenario: A path outside the repository
- **WHEN** a path leaves the repository
- **THEN** validation fails and names the key and the path

#### Scenario: A restricted path
- **WHEN** a path is on the restricted list
- **THEN** validation fails and says why

#### Scenario: Nothing declared
- **WHEN** the file has none of the keys
- **THEN** it is valid and the interface step detects and asks

### Requirement: The shipped configuration documents the keys
The configuration that `init` offers SHALL show the three keys, commented out, with one line that says what each holds.

#### Scenario: A new configuration file
- **WHEN** `init` writes `relevo.yml`
- **THEN** the three keys appear commented out with their explanation
