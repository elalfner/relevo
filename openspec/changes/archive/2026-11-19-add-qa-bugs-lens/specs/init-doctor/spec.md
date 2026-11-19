## MODIFIED Requirements

### Requirement: `doctor` checks that the lens agents are in place
`doctor` SHALL check that the plugin has the five lens agents and that the profile of each platform can be resolved for each lens, and SHALL report a missing agent or a profile that cannot be resolved.

#### Scenario: A plugin without a lens agent
- **WHEN** an installed plugin lacks `qa-security`
- **THEN** `doctor` names it and says to update the plugin

#### Scenario: A plugin without the bugs lens
- **WHEN** an installed plugin lacks `qa-bugs`
- **THEN** `doctor` names it and says to update the plugin

## ADDED Requirements

### Requirement: `doctor` says when the bugs lens is not advisory
`doctor` SHALL report, as a note and never as a failure, the value of `qa.bugs` when it is `blocking` or `off`, saying in one line what it means, and SHALL report nothing about it when it is `advisory` or not set.

#### Scenario: The lens blocks
- **WHEN** `qa.bugs` is `blocking`
- **THEN** `doctor` notes that a `CONFIRMED` finding of the `bugs` lens sends the work back to the developer

#### Scenario: The lens is off
- **WHEN** `qa.bugs` is `off`
- **THEN** `doctor` notes that the `bugs` lens does not run

#### Scenario: The default
- **WHEN** `qa.bugs` is not set
- **THEN** `doctor` prints nothing about it
