## ADDED Requirements

### Requirement: A contradiction sends the issue back with the reason `conflict`
When the check before the build finds that the issue contradicts the project rules or itself, the issue SHALL go back to `needs-spec` with the reason `conflict`, assigned to the spec writer, with a comment that quotes both lines of each pair. Its next step SHALL be to settle which one wins (change the issue, or record an override decision) and label it ready again.

#### Scenario: The comment of the conflict
- **WHEN** the build preflight finds an `Out of scope` line that a rule contradicts
- **THEN** the issue is `needs-spec`, the comment quotes the rule line with its file and line and the `Out of scope` line, and the next step says a person settles which wins

#### Scenario: Next step
- **WHEN** `next-step.mjs --state needs-spec --reason conflict` runs
- **THEN** it prints the command `/relevo:issue {n}` for the spec writer and a hint that names the override decision
