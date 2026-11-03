## ADDED Requirements

### Requirement: The developer agent and QA receive the interface rules that the change touches
After the specification is complete and before the developer agent runs, `go` SHALL select the interface rules for the stack and the text of the tasks and the design, and SHALL give the developer agent their "build it like this" lines and QA their "check this" lines, within the budget of the selection, with the number of rules left out.

#### Scenario: A change that touches a form
- **WHEN** the tasks mention a form on a stack with an interface
- **THEN** the developer agent receives the core rules and the form rules, and QA receives the same rules in their "check this" form

#### Scenario: A stack with no interface
- **WHEN** the profile of the platform has no interface
- **THEN** no interface rule is selected and the run goes on as before

#### Scenario: Over the budget
- **WHEN** more rules match than the budget holds
- **THEN** the output says how many were left out and no blocking core rule is among them

### Requirement: QA rejects on a blocking rule only with evidence
QA SHALL treat a blocking interface rule as a reason to reject only with the evidence that every finding needs, and SHALL list the advisory rules and the rules that only a person can check under "left for on-device review" instead of rejecting for them.

#### Scenario: A blocking rule broken
- **WHEN** the diff shows an icon-only button with no accessible name on a stack where that rule is blocking
- **THEN** QA rejects with the file and line and the rule

#### Scenario: A rule only a person can check
- **WHEN** a rule can be checked only by looking at the screen
- **THEN** QA lists it for the on-device review and does not reject

### Requirement: QA treats a mobile sketch like an image reference
When a `Design reference` holds a sketch for a mobile stack, QA SHALL check that the code plausibly respects the layout, the states and the roles of the colours, and SHALL NOT compare the markup of the sketch with the widget tree of the code.

#### Scenario: A sketch as a reference
- **WHEN** the reference is a mobile sketch and the code shows the same states in the same order with the colours in the same roles
- **THEN** QA does not reject for a difference in markup
