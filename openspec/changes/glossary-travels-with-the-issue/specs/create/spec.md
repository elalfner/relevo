## ADDED Requirements

### Requirement: The issue carries the documentation the agreement settled
When the agreement hands over terms or decision records, `create` SHALL add an optional `## Documentation` section to the issue with the exact text of each: glossary entries to add to `GLOSSARY.md`, and decision records to add to `docs/adr/`. The section SHALL name only those two targets. When nothing is handed over, the section SHALL NOT be written.

#### Scenario: Terms handed over
- **WHEN** the agreement lists two settled terms
- **THEN** the issue has a `Documentation` section that tells the builder to add them to `GLOSSARY.md`, after the existing entries, and shows each entry with its name, definition and words to avoid exactly as agreed

#### Scenario: A decision record handed over
- **WHEN** the agreement lists a decision record
- **THEN** the section shows its title and text, says it goes to `docs/adr/`, and gives no number, because it is numbered when it is written

#### Scenario: Nothing to document
- **WHEN** the agreement says "To document: nothing"
- **THEN** the issue has no `Documentation` section

#### Scenario: A request to document something else
- **WHEN** the person asks the issue to update another file, for example the README
- **THEN** `create` does not put that in the `Documentation` section, and tells the person that the section only carries the glossary and decision records

### Requirement: The documentation section is shown whole at approval
The `Documentation` section SHALL be part of the draft that the person approves, shown in full like the rest, and SHALL pass the same check as any other issue. The check SHALL accept an issue with or without the section and SHALL NOT count the section as a scenario or an edge case.

#### Scenario: Issue with the section
- **WHEN** a draft has scenarios, edge cases and a `Documentation` section
- **THEN** the check passes and counts only the scenarios and edge cases

#### Scenario: Approval
- **WHEN** the draft has a `Documentation` section
- **THEN** the person sees its full text before approving, and nothing is created without a clear yes
