## MODIFIED Requirements

### Requirement: The usage comment shows the replicas apart from the rest
When a log has launches of replicas, the usage comment SHALL list each target apart from the other agents, with its model, its attempts (launches), its turns and an estimated cost, and SHALL say what the replicas cost together and what the rest of the run cost, when the figures are there. The hidden marker SHALL carry the same under `replicas`. When no replica ran, no replica phrase and no `replicas` key SHALL be written, and the comment SHALL be the one it was. When the log has no message of any subagent (the log of a cloud run holds the main agent only), the cost of a replica SHALL be estimated from the real cost of its model shared by the tokens of the subagents on that model, and only when the split is not a guess: the model is not one that the main agent used, every subagent is on a model that the log can name, and the subagents of that model are all replicas or none is. A figure that cannot be estimated that way SHALL be left out.

#### Scenario: Replicas ran
- **WHEN** a run has two replica targets, one of them launched twice
- **THEN** the comment lists both targets with model, attempts, turns and cost, apart from the other agents, with the cost of the replicas and of the rest

#### Scenario: No replica ran
- **WHEN** the log has no replica launch
- **THEN** the comment and the marker have no replica phrase or key

#### Scenario: The cost of a replica is not in the log
- **WHEN** a replica's cost cannot be estimated
- **THEN** the target is listed without a cost and no total is claimed

#### Scenario: The log has the main agent only
- **WHEN** the log has no message of a subagent, and the replicas ran on a model that the main agent did not use
- **THEN** each replica is listed with an estimated cost that is its share, by tokens, of the real cost of that model, and the comment gives the cost of the replicas and of the rest

#### Scenario: The split would be a guess
- **WHEN** the log has no message of a subagent, and the main agent used the model of the replicas, or two models match the model of the replicas, or a subagent of another kind shares that model
- **THEN** the replicas are listed without a cost and no total is claimed

#### Scenario: The marker is read by the digest
- **WHEN** the daily digest reads a marker with `replicas`
- **THEN** it reads the totals as before and ignores the key
