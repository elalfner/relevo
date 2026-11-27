# Spec Delta

## MODIFIED Requirements

### Requirement: The next step comes from one source
The next step shown by every hand-off and failure message SHALL come from one table that gives, for each state of an issue (and the reason or variant where the step depends on one), the command when there is one and who acts, in the language of the repository. Every lifecycle label, and the states `draft` and `closed`, SHALL have an entry. No message or skill SHALL write a command that the table does not give.

#### Scenario: Every state has an entry
- **WHEN** the lifecycle gains a state
- **THEN** a test fails until the table has an entry for it

#### Scenario: Missing information
- **WHEN** the next step is asked for `needs-spec` with the reason `missing`
- **THEN** it is `/relevo:issue <n>`, run by the spec writer

#### Scenario: Ambiguity
- **WHEN** the next step is asked for `needs-spec` with the reason `ambiguous`
- **THEN** it asks the spec writer to decide the open question and then run `/relevo:issue <n>`, and says that `/relevo:think` can explore it first

#### Scenario: Spanish repository
- **WHEN** `language` is `es`
- **THEN** the line is written in Spanish and the command stays unchanged

#### Scenario: A draft
- **WHEN** `next-step.mjs --state draft --issue 7` runs
- **THEN** it prints that the spec writer runs `/relevo:issue 7`, after `/relevo:think #7` if the idea needs exploring

#### Scenario: A closed issue
- **WHEN** `next-step.mjs --state closed --issue 7` runs
- **THEN** it prints that nobody has to act, that the issue was delivered, and that promoting the base branch to the release branch is a separate pull request

#### Scenario: The state read from the labels
- **WHEN** the next step is asked with the labels of an open issue, under their default or configured names
- **THEN** it is the step of its lifecycle state, or of `draft` when no label gives a state

### Requirement: Hand-off message content
Each hand-off message SHALL state what happened, what is expected of the recipient and who acts, the command to run next when there is one, the riskiest area to check first (when known) and the expected time. It SHALL link to long logs instead of embedding them.

#### Scenario: Successful build
- **WHEN** a build passes QA
- **THEN** the assignee is mentioned with: completed tasks, QA result, the branch, the number of scenarios to test, the riskiest area, the short hash of the issue text it was built from, the command `/relevo:review <n>` and the expected time

#### Scenario: Failed build
- **WHEN** a build fails QA after its retries
- **THEN** the assignee is mentioned with the failing finding (file and line), a note that the branch is pushed, and the command `/relevo:fix <n>`

#### Scenario: Failed because the branch already exists
- **WHEN** a run ends because the feature branch already exists on the remote
- **THEN** the message says that the branch was not touched and gives the recovery for its content: `/relevo:fix <n>` when it holds implementation commits, or delete the remote branch and apply `ready` again when it holds only the specification

#### Scenario: Spec returned with a reason
- **WHEN** an issue goes back to the spec writer
- **THEN** the message says whether something is missing or something is ambiguous, and the next step follows from that reason

#### Scenario: A hand-off with no command
- **WHEN** the fix of a hand-off is not a command, as when a reviewer has to be assigned or a workflow edited
- **THEN** the message names who acts and what to do, and gives no command

## ADDED Requirements

### Requirement: Every message says the next step or why nobody acts
Every kind of message SHALL be classified as `hand-off` (says who acts and what to do), `wait` (says that nothing is to be done now and why) or `info`. `info` SHALL be a closed list: the messages printed on the terminal about a local build, and the closing of the progress comment, which only says where the result is. This SHALL hold in every supported language.

#### Scenario: A message with no class
- **WHEN** a kind of message is added and given no class
- **THEN** a test fails and names the kind

#### Scenario: Shipped
- **WHEN** `ship_done` is posted
- **THEN** it says that nothing is left to do for the issue and that promoting the base branch to the release branch is a separate pull request

#### Scenario: Go on an issue already built
- **WHEN** `go_already_built` is posted
- **THEN** it gives the next step, from the table, of the state the issue is in

#### Scenario: A review reminder
- **WHEN** `review_reminder` is posted
- **THEN** it asks the reviewer to approve the pull request or request changes

#### Scenario: A refused label
- **WHEN** a `go`, `ready` or `urgent` label is removed because the person may not apply it
- **THEN** the comment says who can do what was asked, or that nothing is to be done and why

#### Scenario: A fix that tells nobody
- **WHEN** a fix ends on an issue that is `built`, `in-review` or `pr-open`
- **THEN** its comment gives the next step of that state without mentioning anyone

#### Scenario: A build in progress
- **WHEN** the progress comment of a cloud build is posted
- **THEN** it says that nothing is to be done now because the agent is building

### Requirement: A lost runner is a hand-off with the restart
The table SHALL give `building` a variant for a build whose runner stopped answering, with no command and the assignee as who acts. It SHALL say to read the run, remove `relevo:building`, apply `relevo:ready` again (it starts nothing), and then apply `relevo:go` or run `/relevo:go <n>`. The comment that closes the progress of that build SHALL carry the same words in the language of the repository, and SHALL NOT change any label.

#### Scenario: The runner is lost
- **WHEN** the build job ends as failed or cancelled with its progress comment still open
- **THEN** the comment is closed with the run link and the restart of the table, and the issue keeps its labels

#### Scenario: The words drift apart
- **WHEN** the line the workflow writes differs from the table in either language
- **THEN** a test fails

### Requirement: The table has a variant for the local delivery
For a project with `tracker: files`, the table SHALL give an issue whose review passed its own variant: `/relevo:ship <n>`, run by the person. It SHALL speak of no pull request and no approval on GitHub.

#### Scenario: Review passed in a files project
- **WHEN** `review` records a passed review in a project with `tracker: files`
- **THEN** its report ends with `/relevo:ship <n>` from the local variant

### Requirement: The reports of the commands end with the next step
The final report of `review`, `fix` and `ship` SHALL end with the next step, read from the table, of the state the issue is in when the command ends. The report of `init` SHALL end, after its steps by hand, with `/relevo:think` and then `/relevo:issue`, read from the same source. A command that stops with instructions of its own to run again SHALL keep them.

#### Scenario: Review opens the pull request
- **WHEN** `/relevo:review <n>` opens the pull request
- **THEN** the report ends with `/relevo:ship <n>`, run by whoever merges, after someone other than the author approves on GitHub

#### Scenario: Nobody can review
- **WHEN** the review opens the pull request and no member is eligible to review it
- **THEN** the report also gives the step of `needs-reviewer`

#### Scenario: Fix finishes
- **WHEN** `/relevo:fix <n>` finishes on an issue with no pull request
- **THEN** the report ends with the step of `built` or `in-review`, whichever the issue is in

#### Scenario: Fix of an issue with a pull request
- **WHEN** `/relevo:fix <n>` finishes on an issue that had a pull request
- **THEN** the report ends with the step of `pr-open`

#### Scenario: Ship stops
- **WHEN** `/relevo:ship <n>` stops without merging
- **THEN** the report names the state the issue is in and gives the step of that state, and does not say `pr-open` for an issue that is not

#### Scenario: Init ends
- **WHEN** `/relevo:init` ends
- **THEN** the report names `/relevo:think` and then `/relevo:issue` after the steps by hand

### Requirement: The guide has a row for every state
The table of "The life of an issue" in the guide, in English and in Spanish, SHALL have a row for every state of the table, including `draft` and `closed`, with the same commands and owner.

#### Scenario: Reading the guide
- **WHEN** the table of the guide is compared with the table of next steps
- **THEN** `draft` and `closed` have a row, and every command of a state or of its variants is in its row
