# qa-record Specification

## Purpose
Keeps what the gate and the QA reviewers stopped on each attempt and what a person corrected afterwards, so a project can tell what QA is worth with its own figures.

## Requirements

### Requirement: Each attempt of QA is recorded
`go` and `fix` SHALL record, for every attempt, whether the gate was red, each blocking finding with its reviewer and class, and the number of advisory notes. A report that is asked again SHALL NOT be recorded twice.

#### Scenario: A rejection then a pass
- **WHEN** the first attempt is rejected with two findings and the second passes
- **THEN** the record holds both attempts, the two findings in the first

#### Scenario: A red gate
- **WHEN** the gate is red and no reviewer starts
- **THEN** the attempt is recorded with a red gate and no findings

### Requirement: The comment that ends a run carries the record
The comment of a built issue, of a failed build and of a fix SHALL carry the record in one hidden marker that says the command and whether QA passed. The visible text SHALL NOT change because of it, and a run with no record SHALL post the comment it posts today.

#### Scenario: A built issue
- **WHEN** `go` hands a built issue over, from the cloud or from a machine
- **THEN** its comment holds the marker with every attempt

#### Scenario: Recording fails
- **WHEN** the record cannot be read or written
- **THEN** the run ends as it would have and the comment has no marker

### Requirement: The record is safe to publish
The text of a finding SHALL be one line, cut to a bounded length, with known secret shapes redacted, and the record SHALL hold a bounded number of texts and count the rest. With `trust: public` it SHALL hold counts, reviewers and classes and no text.

#### Scenario: A finding that quotes a credential
- **WHEN** a finding of the security reviewer quotes a key
- **THEN** the marker holds the finding with the key redacted

#### Scenario: A public repository
- **WHEN** `trust` is `public`
- **THEN** the marker holds no finding text

### Requirement: A fix says what kind of correction it was
`fix` SHALL classify its correction as `defect` (the code did not do what the specification or a project rule says), `spec-gap` (the specification missed the case), `change` (the person wants other behaviour), `integration` (a conflict or a change of the base branch) or `unfinished` (work a build left unfinished or rejected). It SHALL tell the person, who can correct it, and write it in its comment.

#### Scenario: A defect
- **WHEN** the person reports behaviour that contradicts a scenario of the specification
- **THEN** the comment of the fix says it corrected a defect

#### Scenario: The person disagrees
- **WHEN** the person says it was a change of mind
- **THEN** the recorded kind is `change`

### Requirement: A report adds the records up
`relevo qa-report` SHALL read the records of a repository, optionally since a date, and print the runs recorded, the runs in which QA stopped something, the blocking findings of the first attempt by reviewer and class, those of runs that ended passed, and the corrections of `fix` by kind. It SHALL write nothing and, on request, list the finding texts so a person can judge a sample.

#### Scenario: No records
- **WHEN** no comment carries a record
- **THEN** the report says there is nothing recorded and gives no zero figures

#### Scenario: A run that failed
- **WHEN** a run ended with QA rejecting
- **THEN** its findings are not counted as corrected before the hand-off

### Requirement: Only trusted records are counted
The report and the digest SHALL count a record only from a comment of a bot or of a person with a role in the repository, with exactly one valid marker, and SHALL never infer a figure from the visible text.

#### Scenario: A stranger types a marker
- **WHEN** a comment of a person with no role in the repository holds a marker
- **THEN** it is not counted
