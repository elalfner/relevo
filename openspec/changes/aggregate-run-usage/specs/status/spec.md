## MODIFIED Requirements

### Requirement: Daily digest
A scheduled workflow SHALL post the team-level status to a configured channel once per working day. It SHALL contain who is waiting on what, the alerts and, when the runs of the last seven days have left a usage marker, one line with their aggregate usage: the number of runs, the turns, the cost and the tokens. A run without a marker SHALL NOT be counted, and its figures SHALL NOT be inferred from the text of its comment. A cost that is notional SHALL be said to be notional.

#### Scenario: Digest posted
- **WHEN** the scheduled time arrives on a working day
- **THEN** one digest is posted, and nothing is posted when there is nothing waiting

#### Scenario: Digest with usage
- **WHEN** the digest is posted and three runs of the last seven days left a usage marker
- **THEN** it includes one line with the number of runs and the sum of their turns, cost and tokens

#### Scenario: Runs without a marker
- **WHEN** a run of the last seven days has a usage comment without a marker
- **THEN** it is not counted and the line of usage does not include it

#### Scenario: No usage to report
- **WHEN** no run of the last seven days left a usage marker
- **THEN** the digest has no line of usage and is otherwise unchanged

#### Scenario: Nothing waiting but usage exists
- **WHEN** nothing is waiting and no alert applies, whatever the usage of the last seven days
- **THEN** no digest is posted
