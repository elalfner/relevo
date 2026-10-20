## MODIFIED Requirements

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
- **THEN** `think` does not try to invoke it, asks the person to run `/grill-with-docs` in this same conversation, and in that same message tells them to run `/relevo:create` when the interview ends

### Requirement: Think stops when a required skill is missing
`think` SHALL require the `openspec-explore`, `grill-with-docs`, `grilling` and `domain-modeling` skills. When any is missing, it SHALL NOT start, SHALL name the missing skills and SHALL show how to install them. Relevo SHALL NOT bundle or copy these skills. A skill that is installed but reserved for the person (`disable-model-invocation`) is available but not invocable: it is not missing, and `think` SHALL NOT stop because of it. A skill listed among the available skills is invocable; a skill found only as a folder SHALL have its frontmatter read to tell whether it is.

#### Scenario: A skill is not installed
- **WHEN** `think` runs and `domain-modeling` is not installed
- **THEN** it stops, names `domain-modeling` and shows how to install it

#### Scenario: A skill is installed but reserved for the person
- **WHEN** `think` runs and `grill-with-docs` is installed as a folder whose frontmatter sets `disable-model-invocation`
- **THEN** `think` continues, and later asks the person to launch that skill instead of invoking it

### Requirement: Think hands off to create
When the exploration and the grilling end, `think` SHALL point to `/relevo:create` as the next step, whatever next step the invoked skills suggest on their own, and SHALL say that `create` can use this conversation. When the grilling skill is launched by the person, `think` SHALL give this pointer, and the note that the settled terms stay in "To document" and that nothing was written to the repository, in the message that asks the person to launch it, because `think` may not regain control when that skill ends. It SHALL write the agreement to a file only when the person asks to keep it for another session.

#### Scenario: Invoked skill suggests another next step
- **WHEN** `openspec-explore` suggests `/opsx:propose` as the next step
- **THEN** `think` points to `/relevo:create` instead

#### Scenario: Keeping the agreement
- **WHEN** the person asks to keep the agreement
- **THEN** `think` writes it to the path they choose, says it is not committed, and says `create` can read it from that path

#### Scenario: Hand-off when the person launches the skill
- **WHEN** `think` asks the person to run a reserved grilling skill
- **THEN** the same message says to run `/relevo:create` when the interview ends and that nothing was written to the repository
