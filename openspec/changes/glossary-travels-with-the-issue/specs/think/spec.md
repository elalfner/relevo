## ADDED Requirements

### Requirement: Think hands settled terms and decisions over instead of writing them
`think` SHALL NOT write `GLOSSARY.md` or any file under `docs/adr/` into the repository. It SHALL keep each settled term in the agreement as a name, a definition of one or two sentences and the words to avoid, and each decision record that is warranted as a title and a text, in a part of the agreement named "To document".

#### Scenario: A term settles
- **WHEN** the person and `think` agree on a term
- **THEN** it is added to the "To document" part of the agreement with its name, definition and words to avoid, and no file is written

#### Scenario: A decision record is warranted
- **WHEN** a decision is hard to reverse, surprising without context and the result of a real trade-off
- **THEN** `think` offers a record, and once the person accepts it, it is added to "To document" as a title and a text without a number

#### Scenario: Easily reversed decision
- **WHEN** a decision is cheap to change later
- **THEN** no record is offered

### Requirement: Redirecting the glossary and decision-record writes is the only exception to the invoked skills' rules
`think` SHALL let the exploration and grilling skills it runs follow their own rules, except where such a skill would write `GLOSSARY.md` or a file under `docs/adr/`: there `think` SHALL keep the entry in "To document" and SHALL NOT write the file. Challenging terms, sharpening language and probing with scenarios SHALL stay as the skill does them.

#### Scenario: The skill would update the glossary
- **WHEN** the grilling skill reaches the point where it updates the glossary for a settled term
- **THEN** `think` records the term in "To document" and writes no file, and the questions go on as the skill defines them

#### Scenario: The skill would write a decision record
- **WHEN** the skill offers a decision record and the person accepts it
- **THEN** its title and text are recorded in "To document" and no file is written

### Requirement: Handed-over entries hold vocabulary only
An entry that `think` hands over SHALL NOT contain implementation details, decisions or general programming terms. `think` SHALL keep reading the existing glossary, calling out terms that conflict with it or are vague, and probing boundaries with concrete scenarios.

#### Scenario: Conflicting term
- **WHEN** the person uses a word the glossary defines differently
- **THEN** `think` points out the conflict and asks which meaning is meant, and the entry it hands over uses the meaning they choose

### Requirement: The agreement says what to document
When the interview ends, the agreement SHALL include the "To document" part, even when it is empty, so `create` knows whether there is anything to carry. `think` SHALL tell the person that these entries reach the repository through the issue and are not written by `think`.

#### Scenario: Nothing to document
- **WHEN** no term settled and no decision record was warranted
- **THEN** the agreement says "To document: nothing"

#### Scenario: Hand-off
- **WHEN** the session ends with terms in "To document"
- **THEN** `think` says they will go into the issue as a documentation section and that nothing was written to the repository

## MODIFIED Requirements

### Requirement: Think runs the exploration and grilling skills, it does not restate them
`think` SHALL invoke the `openspec-explore` skill and then the `grill-with-docs` skill, in the same conversation, and SHALL let each skill's own rules govern its part. `think` SHALL NOT reimplement, restate or override how those skills explore, interview, challenge terms or sharpen the project's language. The one exception is where such a skill would write the glossary or a decision record: there `think` keeps the entry in "To document", as the requirement about redirecting those writes says.

#### Scenario: Idea still vague
- **WHEN** the person's idea is still shapeless
- **THEN** `think` stays in `openspec-explore` and compares options with them instead of starting the interview

#### Scenario: Shape of the idea is clear
- **WHEN** the exploration has made the shape of the idea clear
- **THEN** `think` invokes `grill-with-docs` in the same conversation, so the exploration feeds the questions

### Requirement: Writes follow the invoked skills' rules
Any file written while `think` runs, such as OpenSpec artifacts that the person asks for, SHALL be written only as the invoked skill's own rules allow. `think` SHALL NOT write `GLOSSARY.md` or any file under `docs/adr/`, and SHALL NOT write a file itself except the agreement file the person asked for.

#### Scenario: Skill needs permission to write
- **WHEN** an invoked skill requires confirmation before writing
- **THEN** nothing is written until the person gives it

### Requirement: OpenSpec artifacts created at the person's request stay uncommitted
`think` SHALL NOT commit anything it wrote during the session and, when the person asked it to create or change OpenSpec artifacts, SHALL name those files and say they are not committed.

#### Scenario: Hand-off
- **WHEN** the session ends and OpenSpec artifacts were created at the person's request
- **THEN** `think` lists them and says they are not committed

## RENAMED Requirements

- FROM: `### Requirement: Documentation changes stay uncommitted`
- TO: `### Requirement: OpenSpec artifacts created at the person's request stay uncommitted`
