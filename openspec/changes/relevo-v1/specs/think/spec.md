## ADDED Requirements

### Requirement: Think interviews until nothing is left to guess
`think` SHALL interview the person about the idea in rounds. Each round SHALL contain every question whose prerequisites are already settled, each with a recommended answer, and the interview SHALL end only when no question remains and nothing has been silently assumed.

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

### Requirement: The agreement is confirmed before writing
`think` SHALL summarise what was decided and SHALL write the change only after the person confirms the summary.

#### Scenario: Summary not confirmed
- **WHEN** the person corrects the summary
- **THEN** `think` revises it and asks again, and no change is written

### Requirement: Think writes an OpenSpec change from the agreement
After confirmation, `think` SHALL create the OpenSpec change with the OpenSpec command line, with scenarios and edge cases taken from the agreement, and SHALL validate it. It SHALL NOT add behaviour that was not agreed and SHALL record unanswered questions as open questions.

#### Scenario: Unknown answer
- **WHEN** the person does not know the answer to a decision
- **THEN** it is recorded under open questions and no behaviour is specified for it

#### Scenario: Validation fails
- **WHEN** the change does not validate
- **THEN** `think` fixes it and validates again before handing off

### Requirement: Think changes nothing outside the working tree
`think` SHALL NOT write application code, commit, push, create issues or apply labels, and SHALL tell the person where the uncommitted change is and that `create` is the next step.

#### Scenario: Hand-off
- **WHEN** the change has been written
- **THEN** `think` names the folder, lists the open questions and points to `create`
