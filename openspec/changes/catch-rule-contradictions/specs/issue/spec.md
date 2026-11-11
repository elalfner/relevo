## ADDED Requirements

### Requirement: The check finds a draft that contradicts the project rules or itself
The check of a draft SHALL compare the lines of its `Out of scope` section with the project rules (`qa.rules_from`) and with the draft's own scenarios, and SHALL report each pair that conflicts: a problem when a rule is involved, a warning when only a scenario is. A pair conflicts when an `Out of scope` line excludes something that a rule requires, or limits something that a scenario needs. A rule is a requirement unless it is marked `[advice]`. The problem SHALL quote both lines, name the file and line of a rule, and name the scenario by its position and its `WHEN` text, so that a person can confirm it by reading them. The check SHALL NOT decide which of the two wins. A rule that a decision of the draft overrides with a line `Overrides: <file>:<line>` SHALL be skipped.

#### Scenario: Out of scope excludes a required action
- **WHEN** `Out of scope` says "export and the enable/disable actions" and a rule line says every list must offer export and enable/disable actions
- **THEN** the check fails, quoting both lines and the file and line of the rule, and the issue is not created

#### Scenario: Out of scope forbids what a scenario needs
- **WHEN** `Out of scope` lists "changes to the detail page" and a scenario says WHEN the detail page opens THEN no error shows
- **THEN** the check warns, naming that scenario and that limit, and does not fail

#### Scenario: The rule is advice
- **WHEN** the rule line is marked `[advice]`
- **THEN** the check reports nothing for it

#### Scenario: The issue overrides the rule on purpose
- **WHEN** a decision of the draft has the line `Overrides: CLAUDE.md:12` and that line is the rule that conflicts
- **THEN** the check does not report that pair

#### Scenario: A rule that forbids
- **WHEN** a rule line says export must never be offered and `Out of scope` excludes export
- **THEN** the check reports nothing, because they agree

#### Scenario: No rules file
- **WHEN** the project has no rules file
- **THEN** only the comparison of `Out of scope` with the scenarios runs
