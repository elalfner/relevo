# think Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

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

### Requirement: Think stops when a required skill is missing
`think` SHALL require the `openspec-explore`, `grill-with-docs`, `grilling` and `domain-modeling` skills. When any is missing, it SHALL NOT start, SHALL name the missing skills and SHALL show how to install them. Relevo SHALL NOT bundle or copy these skills. A skill that is installed but reserved for the person (`disable-model-invocation`) is available but not invocable: it is not missing, and `think` SHALL NOT stop because of it. A skill listed among the available skills is invocable; a skill found only as a folder SHALL have its frontmatter read to tell whether it is.

#### Scenario: A skill is not installed
- **WHEN** `think` runs and `domain-modeling` is not installed
- **THEN** it stops, names `domain-modeling` and shows how to install it

#### Scenario: A skill is installed but reserved for the person
- **WHEN** `think` runs and `grill-with-docs` is installed as a folder whose frontmatter sets `disable-model-invocation`
- **THEN** `think` continues, and later asks the person to launch that skill instead of invoking it

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
When the interview ends, the agreement SHALL include the "To document" part, even when it is empty, so `issue` knows whether there is anything to carry. `think` SHALL tell the person that these entries reach the repository through the issue and are not written by `think`.

#### Scenario: Nothing to document
- **WHEN** no term settled and no decision record was warranted
- **THEN** the agreement says "To document: nothing"

#### Scenario: Hand-off
- **WHEN** the session ends with terms in "To document"
- **THEN** `think` says they will go into the issue as a documentation section and that nothing was written to the repository

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
