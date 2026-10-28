## MODIFIED Requirements

### Requirement: Daily digest
A scheduled workflow SHALL post the team-level status to a configured channel once per working day. It SHALL contain who is waiting on what, the alerts and, when the runs of the last seven days have left a usage marker, one line with their aggregate usage: the number of runs, the turns, the cost and the tokens. A run without a marker SHALL NOT be counted, and its figures SHALL NOT be inferred from the text of its comment. A cost that is notional SHALL be said to be notional. It SHALL also end with the line of stage times when stages finished in the last seven days.

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

#### Scenario: Nothing waiting but stage times exist
- **WHEN** nothing is waiting and no alert applies, whatever the stages that finished in the last seven days
- **THEN** no digest is posted

## ADDED Requirements

### Requirement: The digest shows how long each stage takes
The digest SHALL give, in one line after the one of usage, the median time and the count of each stage that finished in the last seven days, whenever it began. The stages are `ready` or `queued` to `building`, `building` to `built`, `built` to `in-review`, `in-review` to `pr-open`, and `pr-open` to the issue closed as completed. A stage with no sample SHALL be left out, and a digest with none SHALL have no such line.

#### Scenario: Digest with stage times
- **WHEN** the digest is posted and three builds finished in the last seven days, after 4, 6 and 9 minutes
- **THEN** the line gives the build as 6 minutes with the count 3

#### Scenario: A stage with no sample
- **WHEN** no issue left `in-review` in the last seven days, as in a solo review that skips it
- **THEN** that stage is not in the line and the others are

#### Scenario: A stage that began before the week
- **WHEN** a review began nine days ago and finished two days ago
- **THEN** it counts with its whole length of seven days

#### Scenario: A stage that finished before the week
- **WHEN** a stage finished eight days ago
- **THEN** it is not counted

#### Scenario: No stage finished
- **WHEN** no stage finished in the last seven days
- **THEN** the digest has no line of stage times and is otherwise unchanged

### Requirement: Only a stage that ends on the normal path is timed
A stage SHALL be timed only when it ends with the next state of the normal path. Time spent in `needs-spec`, `blocked`, `qa-failed` or `changes-requested`, and a run that ends in one of them, SHALL NOT be part of any stage. An issue that finishes a stage more than once, such as one built again after a failure, SHALL count each time it finishes it, with the start of that time.

#### Scenario: A build rejected by QA
- **WHEN** an issue goes from `building` to `qa-failed`
- **THEN** that run is not counted as a build and does not change the median of the builds

#### Scenario: Built again after a failure
- **WHEN** an issue failed, was marked `ready` again and then went from `building` to `built`
- **THEN** only that last run counts as a build, from the moment it began building

#### Scenario: Time stopped on a side exit
- **WHEN** an issue was `blocked` for three days between `ready` and `building`
- **THEN** those days are not part of the time of the gate

### Requirement: Stage times are read from GitHub and stored nowhere
The times of the stages SHALL be read from the events that GitHub keeps for the issues of the repository, and nothing SHALL be written for them: no marker, no file and no comment. A read that fails SHALL leave the digest without the line of stage times and SHALL NOT stop the digest from being posted.

#### Scenario: Reading the times
- **WHEN** the digest is built
- **THEN** the times come from the label and close events of the issues and no issue, label or comment is changed

#### Scenario: The events cannot be read
- **WHEN** the read of the events fails
- **THEN** the digest is posted without the line of stage times, with the rest unchanged
