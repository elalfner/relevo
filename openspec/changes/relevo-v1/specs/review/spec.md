## ADDED Requirements

### Requirement: Local session with a device
`review` SHALL run in a local session with a connected device. When no device is connected it SHALL stop and say so.

#### Scenario: No device
- **WHEN** no device appears in the device list
- **THEN** the command stops with instructions to connect one

### Requirement: Synchronise with the base branch first
`review` SHALL merge the current base branch into the feature branch before the person tests, and SHALL re-run QA if the merge changed anything.

#### Scenario: Base moved
- **WHEN** the base branch has new commits since the build
- **THEN** it is merged into the feature branch, QA re-runs, and a conflict that cannot be resolved cleanly stops the review with a clear message

### Requirement: Starting the review claims the issue
When the review starts and the base-branch synchronisation succeeds, `review` SHALL replace `built` with `in-review`, which frees the assignee's capacity.

#### Scenario: Review starts
- **WHEN** the person starts `review` on a `built` issue and the synchronisation succeeds
- **THEN** the issue is labelled `in-review`

#### Scenario: Synchronisation fails
- **WHEN** the base-branch merge cannot be completed
- **THEN** the issue stays `built` and the person is told why

### Requirement: The person drives, the agent observes
The agent SHALL NOT tap, type, swipe or otherwise automate the app or the device, and SHALL NOT use UI automation or monkey tools. Actions in third-party apps that send messages SHALL be performed only by a person.

#### Scenario: Forbidden automation
- **WHEN** the agent is about to issue an input command to the device
- **THEN** it does not, and asks the person to do it

### Requirement: Shot list and checklist
`review` SHALL present a short list of suggested screenshots and a checklist with one line per scenario of the change, including edge cases, then end its turn and wait.

#### Scenario: Waits for the person
- **WHEN** the shot list and checklist are shown
- **THEN** the agent makes no further tool calls until the person writes a message

### Requirement: On-demand capture
When the person writes `capture <name>`, the agent SHALL save a screenshot to the evidence directory and confirm, without opening the image.

#### Scenario: Capture
- **WHEN** the person writes `capture 02_after_tap`
- **THEN** a file `02_after_tap.png` is saved and the agent confirms

### Requirement: Close only on request
The log audit SHALL run only after the person writes that they are done.

#### Scenario: Premature audit
- **WHEN** the person has not said they are done
- **THEN** the agent does not audit the logs or open a pull request

### Requirement: Log audit
On completion, the agent SHALL scan the device log for layout overflows, lifecycle errors, unhandled exceptions, unhandled network or data errors and missing-activity errors, write a report, and return `REVIEW PASSED` or `REVIEW REJECTED`.

#### Scenario: Clean console
- **WHEN** the log contains none of the error classes
- **THEN** the verdict is `REVIEW PASSED`

#### Scenario: Console errors
- **WHEN** the log contains an unhandled exception
- **THEN** the verdict is `REVIEW REJECTED` and the agent offers a confirmed micro-fix loop

### Requirement: Functional bugs go through the spec
A functional or UX defect found during review SHALL NOT be patched live. The agent SHALL direct the person to `/relevo:fix`.

#### Scenario: Bug found
- **WHEN** the person reports that a scenario fails
- **THEN** the agent does not edit code and points to `/relevo:fix`

### Requirement: Pull request only after verification
The pull request SHALL be opened only when the verdict is `REVIEW PASSED` and every checklist line is confirmed working by the person, and only after the person agrees.

#### Scenario: Checklist incomplete
- **WHEN** any checklist line is unconfirmed or failing
- **THEN** no pull request is opened and the issue stays `in-review`

#### Scenario: Verified
- **WHEN** the verdict is passed, the checklist is complete and the person agrees
- **THEN** the branch is pushed, a pull request to the base branch is opened ready for review (not as a draft) with the checklist and `Closes #<n>`, review is requested from the peer, and the issue is labelled `pr-open`

### Requirement: Evidence policy
When `evidence.policy` is `local_only`, screenshots SHALL NOT be attached to the pull request or issue and SHALL be deleted at the end. When it is `attach_to_pr`, they SHALL be attached.

#### Scenario: Sensitive project
- **WHEN** `evidence.policy` is `local_only`
- **THEN** the pull request contains no images and the evidence directory is removed

### Requirement: Safe push
Before pushing, `review` SHALL scan the diff against the base branch for temporary markers and credential patterns and abort on a match.

#### Scenario: Credential in diff
- **WHEN** the diff contains a credential pattern
- **THEN** the push is aborted and the file is named
