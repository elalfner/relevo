# Spec Delta

## MODIFIED Requirements

### Requirement: A violation of a hard rule blocks
A QA finding that cites a rule as `Rule: <file>:<line> "<quoted text>"` SHALL be blocking when the quoted text is found on that line of a file of `qa.rules_from` and the rule is not marked `[advice]`. It blocks whichever lens wrote it and on every attempt, including the `interface` lens on its last attempt, and a report whose first line is `QA PASSED` that contains such a citation SHALL make the result `QA REJECTED`. A citation that does not match the file is not trusted: the finding is treated as it was before and the output lists it as `unverified`. A rule marked `[advice]` blocks nothing, and a finding that cites it is an advisory note, except in a lens that always blocks (`spec`, `security`): there the finding is a note only when its own text names the advice rule, that is, repeats the words quoted from every advice line it cites; otherwise it blocks, because a real problem must not become a note by carrying an advice line. A rule is marked by `[advice]` on its line, or on a heading that holds it.

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

#### Scenario: A real problem that cites advice on the side
- **WHEN** the `security` lens rejects with a finding that describes a vulnerability and also cites an `[advice]` line such as `CLAUDE.md:12 "prefer small functions"`, which the text of the finding does not name
- **THEN** the finding is in `findings`, the result is `QA REJECTED`, and the finding is not in `advisory`

#### Scenario: An always-blocking lens reports only that advice was not followed
- **WHEN** the `spec` lens reports a finding whose text says that "prefer small functions" was not followed and cites that `[advice]` line
- **THEN** the finding is an advisory note and does not block

#### Scenario: Advice and a hard rule, or advice and an unverified line
- **WHEN** a finding cites an advice line and a verified hard rule, or an advice line and a line whose quote is not on it
- **THEN** the hard rule blocks as before, and the unverified line is listed as `unverified` and the finding is treated as one without a trusted advice citation

### Requirement: What the issue asks for is clamped
The issue MAY carry `Model:` for the developer and `QA-model:` for the lenses. For a role on `auto`, the plan SHALL use the value, SHALL NOT go above the ceiling of the role, and SHALL NOT go below its floor: a value outside the range of the role is replaced by the nearest end of it, and the plan says so. Each lens is clamped by its own range. It SHALL ignore the value, and say why in the plan, when `trust` is `public` or the name is not in the ladder. A role that is not on `auto` is never changed by the issue.

#### Scenario: The issue asks for a lower model
- **WHEN** the issue says `Model: haiku` and the developer is on `auto` with the floor `haiku` and the ceiling `sonnet`
- **THEN** the developer runs on `haiku` with the source `issue`

#### Scenario: The issue asks for a model above the ceiling
- **WHEN** the issue says `Model: opus` and the ceiling of the developer is `sonnet`
- **THEN** the developer runs on `sonnet` and the plan says the value was clamped to the ceiling

#### Scenario: The issue asks for a model below the floor
- **WHEN** the lenses are on `auto` with the floor `sonnet` and the issue says `QA-model: haiku`
- **THEN** every lens runs on `sonnet` with the source `issue` and the plan says the value was raised to the floor

#### Scenario: One QA-model, lenses with different ranges
- **WHEN** the issue says `QA-model: sonnet`, the `security` lens has the floor `opus` and the `code` lens has the floor `haiku`
- **THEN** `security` runs on `opus` and `code` runs on `sonnet`

#### Scenario: Public trust
- **WHEN** `trust` is `public` and the issue carries `Model: haiku`
- **THEN** the line is ignored and the plan says why

#### Scenario: A name the ladder does not have
- **WHEN** the issue says `Model: gpt-5`
- **THEN** the line is ignored and the plan names the value and the ladder

### Requirement: The plan scores the size of the change and two raises
For a role on `auto`, the plan SHALL place the model in the range of the role by the size of the change (tasks plus scenarios: up to 6 takes the floor, up to 14 the middle rounded up, more the ceiling). It SHALL raise the pick one step, up to the ceiling, when the issue lists a dependency file in `Allow-paths:` or names a security-sensitive area, and the security lens SHALL go to the ceiling in both cases. With nothing to score, it SHALL use the default model of the role, kept inside the range of the role (a default below the floor is raised to it, one above the ceiling or not in the ladder is not used as it is), and SHALL SAY so.

#### Scenario: A security-sensitive issue
- **WHEN** the issue mentions an authentication or a credential and the security lens is on `auto`
- **THEN** the security lens runs on its ceiling

#### Scenario: Too few signals
- **WHEN** the change has no tasks and no scenarios
- **THEN** every role on `auto` uses the default model of the role and the reason says there was nothing to score

#### Scenario: Too few signals and a default outside the range
- **WHEN** the change has no tasks and no scenarios and the floor of a role on `auto` is above the default model of the role
- **THEN** the role runs on its floor and the reason says the default was raised to it

### Requirement: A reviewed false positive of the credential scan can be listed with a reason
A person SHALL be able to list a credential finding as reviewed in `.relevo/scan-exceptions.json`, a list of entries each with a `path`, a `pattern` and a `reason`. The scan of a diff (the safe commit and the validation gate) SHALL NOT report a credential finding whose file matches the `path` and which the `pattern` describes: the pattern is found in the added line on the text that the finding matched (the pattern holds that text or lies inside it). An entry excuses that finding only: another credential on the same line, one the pattern does not touch, SHALL be reported and the line is not excused. The match SHALL NOT depend on the line number. When it cannot be told which finding an entry covers, the finding SHALL be reported. Every other finding SHALL be reported and refused as before. Temporary markers SHALL NOT be excepted. The list SHALL be read from the committed file (HEAD for a commit, the base ref for the gate), never from the working tree, and `.relevo/` is a protected path, so an unattended run cannot change it.

#### Scenario: A listed line goes through
- **WHEN** the staged diff holds a credential finding on a line that an entry lists by path and pattern, with a reason
- **THEN** the commit is made and the report says one exception was applied, with its path and reason

#### Scenario: The line moved
- **WHEN** the listed line is at another line number of the same file
- **THEN** the exception still applies

#### Scenario: A finding that is not listed
- **WHEN** the scan flags a line no entry covers, or a listed path with another line
- **THEN** the commit is refused and nothing is pushed, as before

#### Scenario: A second credential on the listed line
- **WHEN** an entry has the path `config/sample.env` and the pattern `AKIAIOSFODNN7EXAMPLE`, and a change adds a line in that file with that example key and a second, different credential
- **THEN** the second credential is reported, the line is not excused and the commit is refused

#### Scenario: A second key of the same kind on the listed line
- **WHEN** the line holds the listed example key and another key of the same kind that the pattern does not touch
- **THEN** the other key is reported

#### Scenario: A pattern that is not on the finding
- **WHEN** the pattern is found on the line but not on the text that the credential matched
- **THEN** the credential is reported

#### Scenario: Too broad an entry
- **WHEN** an entry names a folder, uses `**` or a bare `*` file name, has a pattern of fewer than 8 characters, or has no reason
- **THEN** it is never applied and the report names it as refused

#### Scenario: An edit that is not committed
- **WHEN** the working tree holds an exception that the committed file does not
- **THEN** it is not applied

#### Scenario: A marker
- **WHEN** a temporary marker is flagged on a listed line
- **THEN** it is still refused

#### Scenario: The gate
- **WHEN** the validation gate scans a diff with a listed finding
- **THEN** the scan passes and its detail says the exception was applied
