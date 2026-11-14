## ADDED Requirements

### Requirement: The developer has a short default cost guide
The developer agent SHALL carry a fixed cost guide in its own instructions, so every build receives it: read bounded ranges and not whole large files, write a script for repetitive files, run only the tests of what changed, and do not rerun what the gate already ran. The guide SHALL be at most six lines.

#### Scenario: A build starts
- **WHEN** a build starts
- **THEN** the developer agent has the cost guide, whether or not the repository has a config

#### Scenario: Project rules conflict with the guide
- **WHEN** a project rules file or the configured OpenSpec guidance contradicts the cost guide
- **THEN** the project rules win, but never over the rules of Relevo

#### Scenario: The guide stays short
- **WHEN** the guide is edited
- **THEN** a test fails if it exceeds six lines
