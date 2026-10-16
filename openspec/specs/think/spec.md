# think Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.
## Requirements
### Requirement: Think is a thinking partner and never builds
`think` SHALL help the person think an idea through, reading the repository and the specifications as needed, and SHALL NOT write application code, commit, push, create issues or apply labels.

#### Scenario: Asked to build
- **WHEN** the person asks `think` to implement the idea
- **THEN** it declines, and points to `create` for the issues and `go` for the build

### Requirement: Think runs the exploration and grilling skills, it does not restate them
`think` SHALL invoke the `openspec-explore` skill and then the `grill-with-docs` skill, in the same conversation, and SHALL let each skill's own rules govern its part. `think` SHALL NOT reimplement, restate or override how those skills explore, interview or maintain the project's language.

#### Scenario: Idea still vague
- **WHEN** the person's idea is still shapeless
- **THEN** `think` stays in `openspec-explore` and compares options with them instead of starting the interview

#### Scenario: Shape of the idea is clear
- **WHEN** the exploration has made the shape of the idea clear
- **THEN** `think` invokes `grill-with-docs` in the same conversation, so the exploration feeds the questions

### Requirement: Think stops when a required skill is missing
`think` SHALL require the `openspec-explore`, `grill-with-docs`, `grilling` and `domain-modeling` skills. When any is missing, it SHALL NOT start, SHALL name the missing skills and SHALL show how to install them. Relevo SHALL NOT bundle or copy these skills.

#### Scenario: A skill is not installed
- **WHEN** `think` runs and `domain-modeling` is not installed
- **THEN** it stops, names `domain-modeling` and shows how to install it

### Requirement: Think hands off to create
When the exploration and the grilling end, `think` SHALL point to `/relevo:create` as the next step, whatever next step the invoked skills suggest on their own, and SHALL say that `create` can use this conversation. It SHALL write the agreement to a file only when the person asks to keep it for another session.

#### Scenario: Invoked skill suggests another next step
- **WHEN** `openspec-explore` suggests `/opsx:propose` as the next step
- **THEN** `think` points to `/relevo:create` instead

#### Scenario: Keeping the agreement
- **WHEN** the person asks to keep the agreement
- **THEN** `think` writes it to the path they choose, says it is not committed, and says `create` can read it from that path

### Requirement: Writes follow the invoked skills' rules
Any file written while `think` runs, including the glossary, decision records and OpenSpec artifacts, SHALL be written only as the invoked skill's own rules allow. `think` SHALL NOT write a file itself except the agreement file the person asked for.

#### Scenario: Skill needs permission to write
- **WHEN** an invoked skill requires confirmation before writing
- **THEN** nothing is written until the person gives it

### Requirement: Documentation changes stay uncommitted
`think` SHALL NOT commit the documentation written during the session and SHALL name the files that were created or changed.

#### Scenario: Hand-off
- **WHEN** the session ends
- **THEN** `think` lists the files touched and says they are not committed

