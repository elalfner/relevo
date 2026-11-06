# Spec Delta

## ADDED Requirements

### Requirement: The consumption of a run is shown by agent and by model
When the execution log has them, the comment about a cloud run SHALL list for the main agent and each subagent its model, effort, turns, minutes, tokens and an estimated cost, and SHALL give the real cost of each model. The cost of an agent SHALL be written as an estimate. The hidden marker of the comment SHALL carry the same figures under `agents` and `models`. A figure the log does not have SHALL be left out, and a log with none of these figures SHALL give the comment it gives today.

#### Scenario: A run with subagents
- **WHEN** the log shows a developer and four QA lenses, each with its model and tool calls
- **THEN** the comment lists each of them with model, effort, turns, minutes, tokens and "about" its cost, and the real cost of each model

#### Scenario: The costs add up
- **WHEN** the estimated costs of the agents of a model are added
- **THEN** they equal the real cost of that model in the log

#### Scenario: A log without the details
- **WHEN** the log has only the totals of the run
- **THEN** the comment and the marker are the same as before this requirement

#### Scenario: The marker is read by the digest
- **WHEN** the daily digest reads a marker that carries `agents` and `models`
- **THEN** it reads the totals as before and ignores the new keys

### Requirement: A run that stopped at a limit says so
The comment about a run that stopped at a limit SHALL name the limit that was reached (turns of the subagents, minutes or cost) and the agents that did not run.

#### Scenario: A time limit
- **WHEN** a run stops because `limits.run_max_minutes` passed
- **THEN** the comment says the minutes limit was reached, how many minutes the run had used and which agents did not run

#### Scenario: A limit of the runner
- **WHEN** the runner cuts the agent at its turn limit or its cost limit and the log says which
- **THEN** the comment says which of the two it was

#### Scenario: The log does not say
- **WHEN** the job was cancelled or timed out, or the log has no such result
- **THEN** the comment keeps its general wording
