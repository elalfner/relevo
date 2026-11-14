## ADDED Requirements

### Requirement: The documentation describes the interface step, the rules and the keys
The guide, the commands page, the issue format, the stacks page and the configuration page SHALL describe the interface step of `think`, the previews and their check, the rules and how a repository adds to them, the keys of `design.system`, the reading of the tokens and what it cannot resolve, and the vague-word warning, in English and Spanish.

#### Scenario: A reader looks for how to get a preview
- **WHEN** a person reads the commands page for `think`
- **THEN** it says when the interface step runs, that previews are written outside the repository after a yes, and what the check reports

#### Scenario: Both languages
- **WHEN** a page gains a section about these parts
- **THEN** its Spanish page gains the same section with the same structure

### Requirement: The external design skills that were evaluated are listed, and none is recommended by default
The documentation SHALL list the design skills that were evaluated, with the date they were read, the licence they state, the role each suits and the cost of loading it, and SHALL say that none is recommended by default and that `init` installs none. It SHALL say that a design skill with an optional hook edits a settings file, which is a protected path in an unattended run.

#### Scenario: A reader considers a skill
- **WHEN** a person reads the list
- **THEN** each skill has its date, licence, role and cost, and the page says how to add one to a role

#### Scenario: Init
- **WHEN** `init` runs
- **THEN** it installs none of these skills and offers none by default
