## ADDED Requirements

### Requirement: A contradiction is found before any agent turn
Before the agent starts, `build-preflight.mjs --stage issue` SHALL run the same comparison as the check of a draft, against the files of `qa.rules_from`, and SHALL report each conflict as a finding of the kind `conflict`. With a finding the decision is `needs-spec`, the reason is `conflict`, and `missing` quotes both lines of each pair. No model turn is spent. A scenario that the words say needs an excluded line is listed in `notes` and never changes the decision. Without a rules file or without `relevo.yml` only that comparison with the scenarios runs. This stage is an optimisation: QA still reads the rules.

#### Scenario: Conflict found at the preflight
- **WHEN** the issue excludes in `Out of scope` something that a hard rule of `CLAUDE.md` requires
- **THEN** the preflight exits 1 with the reason `conflict` and the agent does not start

#### Scenario: Override recorded
- **WHEN** the issue has a decision with `Overrides: CLAUDE.md:12` for that rule
- **THEN** the preflight does not report it

### Requirement: A violation of a hard rule blocks
A QA finding that cites a rule as `Rule: <file>:<line> "<quoted text>"` SHALL be blocking when the quoted text is found on that line of a file of `qa.rules_from` and the rule is not marked `[advice]`. It blocks whichever lens wrote it and on every attempt, including the `interface` lens on its last attempt, and a report whose first line is `QA PASSED` that contains such a citation SHALL make the result `QA REJECTED`. A citation that does not match the file is not trusted: the finding is treated as it was before and the output lists it as `unverified`. A rule marked `[advice]` blocks nothing, and a finding that cites it is an advisory note. A rule is marked by `[advice]` on its line, or on a heading that holds it.

#### Scenario: Interface lens on the last attempt cites a hard rule
- **WHEN** the `interface` lens, on the last attempt, reports a finding with `Rule: CLAUDE.md:30 "..."` that matches the file
- **THEN** the result is `QA REJECTED` and the finding is in `findings`, not in `advisory`

#### Scenario: A pass that carries a citation
- **WHEN** a report starts with `QA PASSED` and contains a verified `Rule:` citation of a hard rule
- **THEN** the result is `QA REJECTED`

#### Scenario: The quote is not on that line
- **WHEN** a citation names a line whose text does not contain the quote
- **THEN** it is listed as unverified and does not change the result by itself

#### Scenario: Advice
- **WHEN** the cited rule line is marked `[advice]`
- **THEN** the finding is an advisory note and does not block
