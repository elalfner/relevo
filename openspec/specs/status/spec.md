# status Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: Per-person view
`status` SHALL show the person invoking it: the issues waiting on them (with the command to run), the pull requests they must review, and the issues waiting on others.

#### Scenario: Assignee view
- **WHEN** an assignee runs `status`
- **THEN** their `built` issues appear first with their next command, then pull requests awaiting their review, then their issues waiting on a peer

### Requirement: Spec writer view
For the spec writer, `status` SHALL emphasise what blocks them: issues in `needs-spec`, `blocked`, `needs-reviewer`, and the progress of the current milestone.

#### Scenario: Returned specs
- **WHEN** the spec writer runs `status`
- **THEN** issues in `needs-spec` and `blocked` are listed before anything else

### Requirement: Milestone summary and capacity
`status` SHALL summarise the milestone (merged, in review, queued) and SHALL warn when the queued work exceeds what the team can review in the milestone's remaining time.

#### Scenario: Overloaded milestone
- **WHEN** queued plus in-flight issues exceed the review capacity before the milestone due date
- **THEN** a capacity warning is shown

#### Scenario: Milestone without a due date
- **WHEN** the milestone has no due date
- **THEN** no capacity warning is computed and `status` says the milestone has no due date

### Requirement: Alerts
`status` SHALL alert on reviews past `limits.review_sla_hours` and on feature branches that have fallen behind the base branch.

#### Scenario: Stale review
- **WHEN** a pull request has waited longer than the SLA
- **THEN** it appears under alerts with its age

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

### Requirement: Read-only
`status` SHALL NOT change any issue, label or branch.

#### Scenario: Running status
- **WHEN** `status` runs
- **THEN** no write operation is performed

### Requirement: Status shows what blocks an issue from another repository
For each blocked issue, `status` SHALL show the references it waits for and, for an external one, whether it is open, in which Relevo state when the other repository labels its issues, and whether it could not be read.

#### Scenario: Waiting on the back
- **WHEN** issue 7 of the front is blocked by `acme/api#12`, which is open and labelled `relevo:in-review`
- **THEN** the blocked section shows "#7 ... waiting for acme/api#12 (in-review)"

#### Scenario: Unreadable
- **WHEN** the external issue cannot be read
- **THEN** the line says it could not be read instead of a state

### Requirement: Status lists the ready issues the person can build themselves
When the cloud is not building (the go workflow is not installed or `RELEVO_CLOUD_GO` is `off`), `status` SHALL list the `ready` issues assigned to the person with the command `/relevo:go <n>` for each.

#### Scenario: Cloud paused
- **WHEN** `RELEVO_CLOUD_GO` is `off` and issue 42, assigned to the person, is `ready`
- **THEN** their status shows "42 ... → /relevo:go 42"

#### Scenario: Cloud building
- **WHEN** the cloud builds
- **THEN** no such section is shown

### Requirement: Status alerts about a build that stopped reporting
`status` SHALL alert about an issue on `building` whose last activity is older than `limits.building_alert_hours`, with the way to restart it: remove the `building` label and apply `ready` again, or run `/relevo:go <n>` on a machine.

#### Scenario: Stuck build
- **WHEN** an issue has been `building` with no activity for more than the configured hours
- **THEN** an alert names it, the hours, and how to restart it

#### Scenario: Recent activity
- **WHEN** the issue was updated within the configured hours
- **THEN** there is no alert

### Requirement: Status says what it could not read
`status` SHALL record the reads that failed, other than a not-found that answers the question, and SHALL list them in the report with what each affects, and SHALL qualify an empty "nothing is waiting on you" when something could not be read. The JSON output SHALL carry the list.

#### Scenario: The pause variable cannot be read
- **WHEN** `gh` refuses the read of the repository variable that pauses the cloud
- **THEN** the report says it could not read that variable, that the list of ready issues to build by hand may be incomplete, and the exit code is still 0

#### Scenario: Nothing waits and a read failed
- **WHEN** the person has nothing waiting and one read failed
- **THEN** the report says "Nothing is waiting on you." followed by "(from what could be read)" and lists the failed read

#### Scenario: A workflow that is not installed
- **WHEN** the read of the go workflow answers not found
- **THEN** that is the answer that the cloud does not build, and nothing is listed as unread

#### Scenario: Everything was read
- **WHEN** every read succeeds
- **THEN** the report is the same as before and has no "could not read" section

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

### Requirement: The alert on a branch behind the base branch says whether the merge would conflict
For each feature branch that has fallen behind the base branch, `status` SHALL say whether merging the base branch into it would conflict. It SHALL find out without changing any branch or file, and SHALL say that it does not know when the installed tools cannot tell.

#### Scenario: A branch that would conflict
- **WHEN** a feature branch is behind the base branch and the merge would conflict
- **THEN** the alert says so and names the files in conflict

#### Scenario: A branch that merges cleanly
- **WHEN** a feature branch is behind the base branch and the merge would be clean
- **THEN** the alert says so

#### Scenario: The tools cannot tell
- **WHEN** the installed version of git cannot probe a merge without changing the tree
- **THEN** the alert says that it does not know, and nothing is changed

### Requirement: `status` summarises how runs ended and where their time went
In addition to the stage times it already shows, `status` and the daily digest SHALL print, for the runs of a window of days, how many ended in each outcome class and the total seconds of each phase of a build, read from the usage records. They SHALL say how many runs have no record.

#### Scenario: A window with several outcomes
- **WHEN** the window holds runs that were built, stopped for missing inputs and rejected by QA
- **THEN** the summary counts each class and gives the seconds per phase

#### Scenario: Runs from before the records
- **WHEN** some runs of the window have no phases or class
- **THEN** they are counted as without a record, and the rest of the summary is not affected

#### Scenario: Nothing is stored
- **WHEN** the summary is printed
- **THEN** it has been computed from the comments on GitHub and written nowhere else

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
