# Spec Delta

## ADDED Requirements

### Requirement: The guide says what each way to build shows, costs and limits
The page on where `go` runs SHALL compare the cloud build, the local build and the interactive build: what a person sees while each runs, which limits each has, and what each spends. It SHALL give the command that prints the progress of a build on a machine, and SHALL say that an interactive build has no hard limit of turns or cost.

#### Scenario: Choosing how to build on a machine
- **WHEN** a person wants to watch a build and to bound what it spends
- **THEN** the page points to the local build and to the command that prints its progress

#### Scenario: Interactive build
- **WHEN** a person reads about the interactive build
- **THEN** the page says that it shows its subagents, runs on the model and the context of the session, and is not cut by a turn or cost limit

#### Scenario: Permission prompts
- **WHEN** a person asks why an interactive build stops to ask before each command
- **THEN** the page says whether the skill allows its own tools and, if it does not, how to allow them by hand
