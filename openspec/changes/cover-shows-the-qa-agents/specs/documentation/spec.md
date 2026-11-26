# Spec Delta

## ADDED Requirements

### Requirement: The cover shows what each QA agent looks for
Before the section about the queue, the cover SHALL have a section whose title says that Relevo catches mistakes before the person tests, with one table row for each QA agent the plugin ships and what it looks for. It SHALL say that these agents did not write the code, that the project's checks run first and that what blocks is fixed and reviewed again.

#### Scenario: A visitor asks what Relevo catches
- **WHEN** a person reads the section
- **THEN** the table names spec, security, code, bugs and interface with what each hunts

#### Scenario: A new agent
- **WHEN** a QA agent is added to the plugin
- **THEN** a test fails until both covers show it

### Requirement: The cover does not overstate what a QA agent does
The section SHALL say that the interface agent runs when there are screens and that the bugs agent advises unless the project turns its blocking on. It SHALL NOT say that every finding is fixed, nor that Relevo prevents all mistakes.

#### Scenario: The bugs agent
- **WHEN** a person reads the note under the table
- **THEN** it says that bugs advises, or blocks if turned on
