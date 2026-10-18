## RENAMED Requirements

- FROM: `### Requirement: Think hands off to create`
- TO: `### Requirement: Think hands off to issue`

## MODIFIED Requirements

### Requirement: Think is a thinking partner and never builds
`think` SHALL help the person think an idea through, reading the repository and the specifications as needed, and SHALL NOT write application code, commit, push, create issues or apply labels.

#### Scenario: Asked to build
- **WHEN** the person asks `think` to implement the idea
- **THEN** it declines, and points to `issue` for the issues and `go` for the build

### Requirement: Think runs the exploration and grilling skills, it does not restate them
`think` SHALL run the `openspec-explore` skill and then the `grill-with-docs` skill, in the same conversation, and SHALL let each skill's own rules govern its part. `think` SHALL invoke a skill itself only when that skill allows model invocation; a skill whose frontmatter sets `disable-model-invocation` is reserved for the person, so `think` SHALL ask the person to run it in this same conversation and SHALL NOT replicate its flow by another route. `think` SHALL NOT reimplement, restate or override how those skills explore, interview, challenge terms or sharpen the project's language. The one exception is where such a skill would write the glossary or a decision record: there `think` keeps the entry in "To document", as the requirement about redirecting those writes says.

#### Scenario: Idea still vague
- **WHEN** the person's idea is still shapeless
- **THEN** `think` stays in `openspec-explore` and compares options with them instead of starting the interview

#### Scenario: Shape of the idea is clear
- **WHEN** the exploration has made the shape of the idea clear and `grill-with-docs` allows model invocation
- **THEN** `think` invokes `grill-with-docs` in the same conversation, so the exploration feeds the questions

#### Scenario: Grilling skill is reserved for the person
- **WHEN** the exploration is clear and `grill-with-docs` sets `disable-model-invocation`
- **THEN** `think` does not try to invoke it, asks the person to run `/grill-with-docs` in this same conversation, and in that same message tells them to run `/relevo:issue` when the interview ends

### Requirement: Think hands off to issue
When the exploration and the grilling end, `think` SHALL point to `/relevo:issue` as the next step, whatever next step the invoked skills suggest on their own, and SHALL say that `issue` can use this conversation. When the grilling skill is launched by the person, `think` SHALL give this pointer, and the note that the settled terms stay in "To document" and that nothing was written to the repository, in the message that asks the person to launch it, because `think` may not regain control when that skill ends. It SHALL write the agreement to a file only when the person asks to keep it for another session.

#### Scenario: Invoked skill suggests another next step
- **WHEN** `openspec-explore` suggests `/opsx:propose` as the next step
- **THEN** `think` points to `/relevo:issue` instead

#### Scenario: Keeping the agreement
- **WHEN** the person asks to keep the agreement
- **THEN** `think` writes it to the path they choose, says it is not committed, and says `issue` can read it from that path

#### Scenario: Hand-off when the person launches the skill
- **WHEN** `think` asks the person to run a reserved grilling skill
- **THEN** the same message says to run `/relevo:issue` when the interview ends and that nothing was written to the repository

### Requirement: The agreement says what to document
When the interview ends, the agreement SHALL include the "To document" part, even when it is empty, so `issue` knows whether there is anything to carry. `think` SHALL tell the person that these entries reach the repository through the issue and are not written by `think`.

#### Scenario: Nothing to document
- **WHEN** no term settled and no decision record was warranted
- **THEN** the agreement says "To document: nothing"

#### Scenario: Hand-off
- **WHEN** the session ends with terms in "To document"
- **THEN** `think` says they will go into the issue as a documentation section and that nothing was written to the repository
