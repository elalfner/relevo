## MODIFIED Requirements

### Requirement: An installation holds only what runs
The published package SHALL contain the plugin manifest, scripts, skills, agents, stack profiles, the knowledge folder, templates, the licence and the notice, and nothing else from the repository, and the marketplace entry SHALL install the plugin from that package.

#### Scenario: Installing at project scope
- **WHEN** a person installs the plugin with the project scope
- **THEN** the plugin cache holds the contents of the package and no documentation, tests, OpenSpec history, changelog or brand material

#### Scenario: A file outside the package is needed at run time
- **WHEN** a skill or script reads a file that the package does not contain
- **THEN** a test fails, because an installation would not have it

#### Scenario: The knowledge is in the package
- **WHEN** the package is packed
- **THEN** it contains the knowledge folder with the rules and the translations of each stack, and no fixture of the tests
