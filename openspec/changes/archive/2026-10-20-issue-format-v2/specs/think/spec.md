## ADDED Requirements

### Requirement: The agreement is written in two moments with ids
Before asking the person to run a grilling skill reserved for them, `think` SHALL write down what the exploration settled as a list with ids (decisions `D<n>`, constraints `C<n>`, assumptions `A<n>`, open questions `Q<n>`), and `issue` SHALL complete it with what the interview settles, in the same conversation.

#### Scenario: Interview reserved for the person
- **WHEN** `think` asks the person to run the grilling skill
- **THEN** the same message holds the list of what the exploration settled, each item with its id

### Requirement: Think can start from an issue that needs its specification
`think` SHALL accept an issue number (`42` or `#42`), read the body and the last `needs-spec` comment with read-only `gh` commands, and start from them. The `needs-spec` comment SHALL say whether the reason is `missing` (go straight to `/relevo:issue <n>`) or `ambiguous` (decide, and think first if exploration is needed).

#### Scenario: Ambiguous issue
- **WHEN** the person runs `/relevo:think #42` and issue 42 was sent back as ambiguous
- **THEN** `think` reads its body and the last comment, and starts the exploration from what is unclear

#### Scenario: Missing information only
- **WHEN** the comment says the reason is `missing`
- **THEN** the next step named is `/relevo:issue 42`, without a `think`

### Requirement: A long session can be continued in a clean chat
When the session is long, `think` SHALL offer to save the agreement so the person can continue with `/relevo:issue <path>` in a new conversation, and SHALL write the file only after a direct yes.

#### Scenario: Offer in a long session
- **WHEN** the exploration has been long
- **THEN** `think` offers to save the agreement and writes nothing before the person says yes

### Requirement: Think uses only read-only OpenSpec commands
`think` SHALL use only `openspec list`, `openspec show` and `openspec status`, in addition to what the invoked skills do under their own rules, and SHALL NOT run `init`, `update`, `validate` or `sync`. When it needs the code of another repository it SHALL ask the person to add it to the session.

#### Scenario: Forbidden command
- **WHEN** a step would need `openspec validate`
- **THEN** `think` does not run it and says it is for the builder
