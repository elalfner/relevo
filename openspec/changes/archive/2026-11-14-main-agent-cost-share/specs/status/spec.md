## ADDED Requirements

### Requirement: The digest shows the share of the main agent
The daily digest SHALL add one line after the line of usage with the share of the cost that the main agent used and the turns it used out of all the turns, over the runs of the last seven days whose usage marker has the detail of the agents. The line SHALL give the number of runs it covers out of the runs of the usage line.

#### Scenario: Runs with the detail
- **WHEN** three runs of the last seven days have agent detail and the main agent used 5 of the 10 dollars they cost, in 300 of their 420 turns
- **THEN** the digest has a line that says the main agent used 50 % of the cost and 300 of 420 turns, over 3 of 3 runs

#### Scenario: A notional cost
- **WHEN** the cost of the runs is notional because the credential is a subscription
- **THEN** the share is still shown, because it is a ratio over the same runs

#### Scenario: Language of the line
- **WHEN** `language` in `relevo.yml` is Spanish
- **THEN** the line is in Spanish, with the same figures

### Requirement: Only the runs that have the detail are counted
A run whose usage marker has no agent detail, or no cost for the main agent, SHALL NOT be counted in the share of the main agent, and its figures SHALL NOT be inferred from the text of its comment. Without any such run the digest SHALL have no line about the main agent.

#### Scenario: Some runs without the detail
- **WHEN** four runs left a usage marker and only two of them have the agents of the run
- **THEN** the share is computed over those two, and the line says it covers 2 of 4 runs

#### Scenario: No run with the detail
- **WHEN** runs left a usage marker but none has agent detail, or none has a cost for the main agent
- **THEN** the digest has no line about the main agent, and the line of usage is as it was

### Requirement: The line about the main agent informs and decides nothing
The digest SHALL say in words, on the line about the main agent, when the share of the cost is above half. It SHALL NOT change the model or the turns of any agent, `limits.run_max_turns`, or `limits.run_max_cost`, and SHALL NOT post anything of its own when nothing is waiting.

#### Scenario: Share above half
- **WHEN** the main agent used more than half of the cost of the runs it covers
- **THEN** the line says that it is above half, and no setting or limit is changed

#### Scenario: Share at or below half
- **WHEN** the main agent used half of the cost or less
- **THEN** the line gives the figures without that remark

#### Scenario: Nothing waiting
- **WHEN** nothing is waiting and no alert applies, whatever the share
- **THEN** no digest is posted, as for the line of usage
