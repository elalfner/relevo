## MODIFIED Requirements

### Requirement: The consumption of a run is shown by agent and by model
When the execution log has them, the comment about a cloud run SHALL list for the main agent and each subagent its model, effort, turns, minutes, tokens and an estimated cost, and SHALL give the real cost of each model. The cost of an agent SHALL be written as an estimate. The launches of replicas SHALL NOT be in that list: they are shown apart (see "The usage comment shows the replicas apart from the rest"). The hidden marker of the comment SHALL carry the same figures under `agents` and `models`. A figure the log does not have SHALL be left out, and a log with none of these figures SHALL give the comment it gives today.

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

## ADDED Requirements

### Requirement: The usage comment shows the replicas apart from the rest
When a log has launches of replicas, the usage comment SHALL list each target apart from the other agents, with its model, its attempts (launches), its turns and an estimated cost, and SHALL say what the replicas cost together and what the rest of the run cost, when the figures are there. The hidden marker SHALL carry the same under `replicas`. When no replica ran, no replica phrase and no `replicas` key SHALL be written, and the comment SHALL be the one it was.

#### Scenario: Replicas ran
- **WHEN** a run has two replica targets, one of them launched twice
- **THEN** the comment lists both targets with model, attempts, turns and cost, apart from the other agents, with the cost of the replicas and of the rest

#### Scenario: No replica ran
- **WHEN** the log has no replica launch
- **THEN** the comment and the marker have no replica phrase or key

#### Scenario: The cost of a replica is not in the log
- **WHEN** a replica's cost cannot be estimated
- **THEN** the target is listed without a cost and no total is claimed

#### Scenario: The marker is read by the digest
- **WHEN** the daily digest reads a marker with `replicas`
- **THEN** it reads the totals as before and ignores the key
