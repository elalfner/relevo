## MODIFIED Requirements

### Requirement: An issue with unanswered questions is not complete
The check SHALL fail a draft whose `Open questions` section has content or whose text contains `NEEDS CLARIFICATION`, and SHALL fail one whose decision or constraint ids are repeated or malformed. It SHALL warn, without failing, when the body is over 8,000 characters, not counting the fenced example code of the `Design reference` section, which has its own limits.

#### Scenario: Open question
- **WHEN** a draft has a question under `Open questions`
- **THEN** the check fails and names the section

#### Scenario: Repeated id
- **WHEN** two decisions are both `D1`
- **THEN** the check fails and names the id

#### Scenario: Long body
- **WHEN** the body has 9,000 characters
- **THEN** the check passes with a warning about the length

#### Scenario: Long example code
- **WHEN** the body has 5,000 characters of text and 12,000 characters of example code in `Design reference`
- **THEN** the check gives no warning about the length of the body

## ADDED Requirements

### Requirement: `issue` asks the interface questions that the idea does not answer
When the feature has a visible part, `issue` SHALL ask the interface questions that the rules and the stack give for it and that the idea and the agreement have not already answered, and SHALL NOT ask what the agreement settled.

#### Scenario: Decisions already in the agreement
- **WHEN** the agreement already settles how the loading and error states look
- **THEN** `issue` does not ask about them and carries the decisions into the issue

#### Scenario: A state nobody settled
- **WHEN** nothing settles what the screen shows when there is no data
- **THEN** `issue` asks

### Requirement: The chosen option travels in `Design reference` as example code
When the agreement holds a chosen preview, `issue` SHALL write it in a fenced block in `Design reference`, in a bullet that says what must match: for the web, the structure, the tokens and the states and not the sample text or exact pixel values; for a mobile sketch, the layout, the spacing, the states and the role of each colour, and that its markup is not to be reproduced.

#### Scenario: A web preview
- **WHEN** the person chose a preview of a web stack
- **THEN** the issue has the preview as example code with a bullet that names structure, tokens and states

#### Scenario: A mobile sketch
- **WHEN** the person chose a sketch of a mobile stack
- **THEN** the bullet names layout, spacing, states and colour roles and says that the markup is not to be copied, and the decision with its table of states is in `Decisions`

#### Scenario: A picture instead
- **WHEN** the person commits a picture of the sketch to the repository
- **THEN** `issue` may point to that file instead of embedding the sketch

### Requirement: Example code has its own limits
The check SHALL warn when one block of example code in `Design reference` is over 16 KB and fail it over 32 KB, SHALL warn when all the blocks together are over 32 KB, and SHALL fail a body larger than GitHub accepts, with a message that suggests committing the file and pointing to it.

#### Scenario: A large block
- **WHEN** one block is 20 KB
- **THEN** the check passes with a warning

#### Scenario: A block over the limit
- **WHEN** one block is 40 KB
- **THEN** the check fails and says to commit the file and reference it

#### Scenario: A body GitHub would refuse
- **WHEN** the body is larger than GitHub accepts
- **THEN** the check fails and says why

### Requirement: Vague appearance words are a warning that becomes a question
The check SHALL warn, without failing, about a vague appearance word in a scenario, a decision, a constraint or a reference bullet, using a list of words for each language with English as the fallback, and SHALL ignore a sentence that carries a number with a unit, a token name in backticks or a reference. `issue` SHALL show each warning and ask which value, token or reference is meant, and the person MAY keep the word on purpose.

#### Scenario: A vague word
- **WHEN** a scenario says that a loading indication is discreet and gives no value
- **THEN** the check warns and `issue` asks which value or reference is meant

#### Scenario: A word with a criterion
- **WHEN** the sentence gives the width in pixels or names a token
- **THEN** the check does not warn

#### Scenario: Kept on purpose
- **WHEN** the person says to keep the word
- **THEN** the issue is created with it and the check still passes
