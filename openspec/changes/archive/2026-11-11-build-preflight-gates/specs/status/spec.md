## ADDED Requirements

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
