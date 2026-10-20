## ADDED Requirements

### Requirement: An empty or foreign log is inconclusive
The audit SHALL return a third verdict, `REVIEW INCONCLUSIVE`, when the log is empty or when no line of it was written by the application under review. The pull request SHALL NOT be opened on this verdict, and it SHALL NOT be waived.

#### Scenario: Empty log
- **WHEN** the device log is empty
- **THEN** the verdict is `REVIEW INCONCLUSIVE`, not `REVIEW PASSED`

#### Scenario: Only other apps in the log
- **WHEN** the log has lines but none of them belongs to the application under review
- **THEN** the verdict is `REVIEW INCONCLUSIVE` and the person is asked to restart the app and repeat the steps

#### Scenario: Not waivable
- **WHEN** the person tries to waive an inconclusive audit
- **THEN** the waiver is refused

### Requirement: Findings can be waived by the person, with a reason
Only the person SHALL be able to waive a finding of the audit, one at a time, with `waive <number> <reason>` and a non-empty reason; the agent SHALL NOT propose or apply one. When every finding is waived the verdict SHALL be `REVIEW PASSED (with waivers)`, which allows the pull request, and the waived findings with their reasons SHALL appear in the report and the pull request body. A finding not waived SHALL still block. A waiver SHALL survive a new audit of the same finding and be cleared when the specification changes.

#### Scenario: Waiver with a reason
- **WHEN** the person writes `waive 2 known warning of the camera plugin` for finding 2
- **THEN** the finding is waived with that reason

#### Scenario: Waiver without a reason
- **WHEN** the person writes `waive 2` with no reason
- **THEN** the waiver is refused and the finding still blocks

#### Scenario: Every finding waived
- **WHEN** every finding of the audit is waived
- **THEN** the verdict is `REVIEW PASSED (with waivers)` and the pull request body lists them with their reasons

#### Scenario: A finding left
- **WHEN** one finding is not waived
- **THEN** the verdict is `REVIEW REJECTED` and no pull request is opened

#### Scenario: New audit after a micro-fix
- **WHEN** the audit runs again and a waived finding appears with the same class and text
- **THEN** it stays waived

#### Scenario: Specification changed
- **WHEN** a fix changes the specification and the review is synchronised
- **THEN** the waivers are cleared

### Requirement: A micro-fix is committed before the pull request
A micro-fix made during the review SHALL be committed with the explicit files, the scan and a message `fix: <summary> (#<issue>)`, before the pull request opens.

#### Scenario: Micro-fix accepted
- **WHEN** the person accepted a micro-fix and the audit passes afterwards
- **THEN** the fix is a commit on the branch and the pull request contains it

### Requirement: The log is kept as the review goes
After each message from the person, `review` SHALL append the device log to a file under `evidence/` and clear it on the device, and the audit SHALL read that accumulated file, so a long review cannot lose lines to the device's buffer.

#### Scenario: Long review
- **WHEN** the person tests for a long time and sends several messages
- **THEN** the log lines of the whole session are in the file the audit reads

### Requirement: The person running the review is the assignee, or confirms
`review` SHALL compare the assignee of the issue with the login of the person running it and, when they differ, SHALL ask for a written confirmation before it goes on.

#### Scenario: Someone else runs the review
- **WHEN** the assignee is one person and another runs `review`
- **THEN** the review stops until the person confirms in writing that they review it

### Requirement: An existing pull request is reused
Before it opens a pull request, `review` SHALL look for one for the branch; if it exists it SHALL be reused. A rejected push SHALL stop the review with the reason and SHALL NOT be forced.

#### Scenario: Pull request already open
- **WHEN** a pull request for the branch already exists
- **THEN** no second one is created and the issue moves to `pr-open` with the existing link

#### Scenario: Push rejected
- **WHEN** the push is rejected
- **THEN** the review stops, says why and force-pushes nothing

## MODIFIED Requirements

### Requirement: Synchronise with the base branch first
`review` SHALL bring in the remote copy of the feature branch with a fast-forward pull, then merge the current base branch into it before the person tests, and SHALL re-run QA if either brought anything.

#### Scenario: Base moved
- **WHEN** the base branch has new commits since the build
- **THEN** it is merged into the feature branch, QA re-runs, and a conflict that cannot be resolved cleanly stops the review with a clear message

#### Scenario: Branch pushed from another machine
- **WHEN** the remote branch has commits the local one does not
- **THEN** they are brought in before the base is merged, so the person tests the current code

### Requirement: Log audit covers only the app under review
The log audit SHALL read only the log lines written by the processes of the application under review, identified by its application id, and SHALL NOT audit or quote lines from other applications on the device. When the log does not name the application's process, the verdict SHALL be `REVIEW INCONCLUSIVE`.

#### Scenario: Another app logs an error
- **WHEN** another application on the device logs an unhandled exception and the application under review logs none
- **THEN** the verdict is `REVIEW PASSED` and the report does not quote the other application's line

#### Scenario: The application's process is not in the log
- **WHEN** the log never names the process of the application under review
- **THEN** the verdict is `REVIEW INCONCLUSIVE` and the output and the report say why

### Requirement: Pull request only after verification
The pull request SHALL be opened only when the verdict is `REVIEW PASSED` or `REVIEW PASSED (with waivers)` and every checklist line is confirmed working by the person, and only after the person agrees.

#### Scenario: Checklist incomplete
- **WHEN** any checklist line is unconfirmed or failing
- **THEN** no pull request is opened and the issue stays `in-review`

#### Scenario: Verified
- **WHEN** the verdict is passed, the checklist is complete and the person agrees
- **THEN** the branch is pushed, a pull request to the base branch is opened ready for review (not as a draft) with the checklist and `Closes #<n>`, review is requested from the peer (unless `review.mode` is `none`), and the issue is labelled `pr-open`

#### Scenario: Inconclusive audit
- **WHEN** the verdict is `REVIEW INCONCLUSIVE`
- **THEN** no pull request is opened
