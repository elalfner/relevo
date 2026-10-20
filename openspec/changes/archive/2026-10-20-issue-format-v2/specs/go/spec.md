## ADDED Requirements

### Requirement: Sections of the issue are copied word for word
`go` SHALL copy the sections `Decisions`, `Constraints`, `Code pointers`, `Screens and behaviour`, `Data contract`, `Verification` and `Assumptions` of the issue into `design.md`, each under the heading `From the issue: <Section>`, using a script that copies the text unchanged. The `Documentation` section keeps its own task and heading.

#### Scenario: Decisions in the issue
- **WHEN** the issue has a `Decisions` section
- **THEN** `design.md` has "From the issue: Decisions" with that text unchanged

#### Scenario: Section absent
- **WHEN** the issue has no `Constraints` section
- **THEN** `design.md` has no such heading

### Requirement: An issue with open questions is sent back as ambiguous
When the issue has an `Open questions` section with content or the text `NEEDS CLARIFICATION`, `go` SHALL NOT build it: it SHALL move it to `needs-spec` with the reason `ambiguous`, naming the question.

#### Scenario: Question left in the issue
- **WHEN** a `ready` issue has a question under `Open questions`
- **THEN** it becomes `needs-spec` with the reason `ambiguous` and nothing is built

### Requirement: QA applies what the issue decided
QA SHALL reject a change that breaks a decision or a constraint copied from the issue, citing its id, and SHALL reject when the sections in `design.md` differ from the ones in the issue.

#### Scenario: Decision broken
- **WHEN** the issue decided `D2` (sort by date) and the diff sorts by name
- **THEN** QA rejects it citing `D2`

#### Scenario: Section reworded
- **WHEN** a copied section in `design.md` differs from the issue
- **THEN** QA rejects it citing the section
