## ADDED Requirements

### Requirement: Status shows what blocks an issue from another repository
For each blocked issue, `status` SHALL show the references it waits for and, for an external one, whether it is open, in which Relevo state when the other repository labels its issues, and whether it could not be read.

#### Scenario: Waiting on the back
- **WHEN** issue 7 of the front is blocked by `acme/api#12`, which is open and labelled `relevo:in-review`
- **THEN** the blocked section shows "#7 ... waiting for acme/api#12 (in-review)"

#### Scenario: Unreadable
- **WHEN** the external issue cannot be read
- **THEN** the line says it could not be read instead of a state
