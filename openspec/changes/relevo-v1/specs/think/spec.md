## ADDED Requirements

### Requirement: Think is a thinking partner and never builds
`think` SHALL explore the idea with the person, reading the repository and the specifications as needed, and SHALL NOT write application code, commit, push, create issues or apply labels.

#### Scenario: Asked to build
- **WHEN** the person asks `think` to implement the idea
- **THEN** it declines, and points to `create` for the issues and `go` for the build

### Requirement: Explore before interviewing
`think` SHALL look up what the repository and the conversation already answer, explore the idea (options, risks, unknowns, pictures where they help) and begin the interview only when the shape of the idea is clear enough for precise questions. The person MAY stop, change direction or defer a decision at any time.

#### Scenario: Idea still vague
- **WHEN** the person's idea is still shapeless
- **THEN** `think` explores and compares options with them instead of asking detailed questions

### Requirement: Think interviews until nothing is left to guess
`think` SHALL interview the person in rounds. Each round SHALL contain every question whose prerequisites are already settled, each with a recommended answer, and the interview SHALL end only when no question remains and nothing has been silently assumed.

#### Scenario: A decision opens new questions
- **WHEN** the person's answer to a question raises further decisions
- **THEN** those questions are asked in the next round and not before

#### Scenario: Question depends on an open question
- **WHEN** a question can only be asked once another question in the same round is answered
- **THEN** it is held for a later round

### Requirement: Facts are looked up, decisions are asked
`think` SHALL find facts about the code and the repository itself and SHALL ask the person only for decisions.

#### Scenario: A question needs a fact from the code
- **WHEN** a question depends on how the existing code works
- **THEN** a subagent finds out and the person is not asked

### Requirement: The agreement is explicit
When the interview ends, `think` SHALL state the agreement as what is decided, what is still open and what is only a proposed default, and SHALL treat silence as no acceptance. It SHALL NOT invent answers; what the person does not know is recorded as an open question.

#### Scenario: Unknown answer
- **WHEN** the person does not know the answer to a decision
- **THEN** it is listed as an open question and no behaviour is assumed for it

#### Scenario: Summary corrected
- **WHEN** the person corrects the agreement
- **THEN** `think` revises it and asks again

### Requirement: Nothing is written without permission
`think` SHALL ask once, with a direct yes or no question naming both, whether it may create and update the glossary and the decision records while it works, and SHALL write nothing without that yes. It SHALL write the agreement to a file only when the person asks to keep it for another session, and SHALL point to `create` as the next step.

#### Scenario: Permission not given
- **WHEN** the person declines
- **THEN** no file is written and the terms and decisions are carried in the agreement

#### Scenario: Keeping the agreement
- **WHEN** the person asks to keep the agreement
- **THEN** `think` writes it to the path they choose, says it is not committed, and says `create` can read it from that path

### Requirement: Think sharpens the project's language
`think` SHALL read the glossary, call out terms that conflict with it or are vague, propose one precise term with the words to avoid, probe boundaries with concrete scenarios, and check what the person says against the code.

#### Scenario: Conflicting term
- **WHEN** the person uses a word the glossary defines differently
- **THEN** `think` points out the conflict and asks which meaning is meant

#### Scenario: Statement contradicted by the code
- **WHEN** the person describes behaviour the code does not have
- **THEN** `think` raises the contradiction before moving on

### Requirement: The glossary holds vocabulary only
With permission, `think` SHALL write each term to the glossary as soon as it settles, as a name, a short definition and the words to avoid, and SHALL NOT put implementation details, decisions or general programming terms in it.

#### Scenario: Term settles
- **WHEN** the person and `think` agree on a term
- **THEN** it is added to the glossary immediately with its definition and words to avoid

### Requirement: Decision records are offered sparingly
`think` SHALL offer a decision record only when the decision is hard to reverse, surprising without context and the result of a real trade-off, and SHALL number records sequentially in `docs/adr/`.

#### Scenario: Easily reversed decision
- **WHEN** a decision is cheap to change later
- **THEN** no record is offered

### Requirement: Documentation changes stay uncommitted
`think` SHALL NOT commit the documentation it wrote and SHALL name the files it created or changed.

#### Scenario: Hand-off
- **WHEN** the session ends
- **THEN** `think` lists the glossary and decision-record files it touched and says they are not committed
