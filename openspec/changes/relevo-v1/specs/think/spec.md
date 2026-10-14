## ADDED Requirements

### Requirement: Think turns an idea into an issue Relevo can build
`think` SHALL help a person turn an idea, a conversation or an OpenSpec exploration into one or more issues that satisfy the issue format, so that `go` never has to ask a question or guess.

#### Scenario: Starting from earlier context
- **WHEN** the person runs `think` after discussing the feature, or while a change exploration exists in the repository
- **THEN** `think` summarises in a few lines what it already knows and asks only about what is still missing

### Requirement: Questions are asked only for what is missing
`think` SHALL ask about scenarios, edge cases, dependencies on other work, screens and behaviour when the feature has a visible part, and data contracts when it reads or writes data, and SHALL NOT ask what the earlier context already answers. It SHALL NOT invent scenarios or edge cases the person did not give.

#### Scenario: Behaviour is unclear
- **WHEN** the person's answer leaves the visible behaviour ambiguous
- **THEN** `think` asks a follow-up question instead of writing an assumption into the scenarios

### Requirement: Dependencies are explicit
When the feature needs work that does not exist yet in this repository or elsewhere, `think` SHALL ask whether an issue already covers it. If one does, it SHALL record `Depends-on: #N`. If none does, it SHALL offer to draft that work as a separate issue and link the two.

#### Scenario: Work in another issue
- **WHEN** the person says the data comes from work tracked in issue 12
- **THEN** the new issue contains `Depends-on: #12`

#### Scenario: Work nobody has written yet
- **WHEN** the feature needs a piece of work with no issue
- **THEN** `think` offers to write that piece as its own issue first and links the second to it

### Requirement: One issue, one buildable unit
`think` SHALL propose splitting a feature that cannot be reviewed on one device pass, and SHALL give every resulting issue its own scenarios and edge cases, with the order expressed through `Depends-on`.

#### Scenario: Large feature
- **WHEN** the feature spans work that can be built and verified separately
- **THEN** `think` proposes several issues and the person decides how many to create

### Requirement: Issues are checked before they are created
Before creating anything, `think` SHALL check each draft with the same rules `go` applies: at least one complete scenario, at least one edge case, no leftover template text, no emoji in the title, a title of at most 72 characters, and nothing that looks like a credential.

#### Scenario: Missing edge cases
- **WHEN** a draft has no edge case
- **THEN** the check fails, `think` says what is missing and does not create the issue

#### Scenario: Credential in the text
- **WHEN** a draft contains something that looks like a credential
- **THEN** the check fails and the issue is not created

### Requirement: Approval before creation
`think` SHALL show every draft in full together with its milestone, assignee and order, and SHALL create issues only after the person approves them explicitly.

#### Scenario: Not approved
- **WHEN** the person asks for changes
- **THEN** `think` revises the drafts and shows them again, and nothing is created

### Requirement: Milestone and assignee
`think` SHALL ask which milestone each issue belongs to and who will develop it, offering the open milestones and the members from `relevo.yml`, and SHALL create a milestone only when the person asks.

#### Scenario: Milestone does not exist
- **WHEN** the person names a milestone that does not exist
- **THEN** `think` asks whether to create it and does so only on a yes

### Requirement: Think never starts a build
`think` SHALL NOT apply the `ready` label. Applying it is the writer's explicit decision that the specification is finished, and it is what starts `go`.

#### Scenario: Issues created
- **WHEN** the issues have been created
- **THEN** `think` lists their links, reminds the person that `go` starts when `ready` is applied, and applies no lifecycle label

### Requirement: Think respects the language setting
`think` SHALL write the issues in the language set by `language` in `relevo.yml`, unless the person asks for another, and SHALL keep the `WHEN`, `THEN` and `Depends-on` keywords in English because `go` reads them.

#### Scenario: Spanish repository
- **WHEN** `language` is `es`
- **THEN** the issue text is in Spanish and the keywords `WHEN` and `THEN` stay in English
