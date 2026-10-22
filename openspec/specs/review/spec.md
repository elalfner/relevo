# review Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: Local session with a device
`review` SHALL run in a local session with a connected device. When no device is connected it SHALL stop and say so.

#### Scenario: No device
- **WHEN** no device appears in the device list
- **THEN** the command stops with instructions to connect one

### Requirement: Choosing the device
When several devices are ready, `review` SHALL use the one named by `ANDROID_SERIAL` and otherwise stop and list them. A device that is connected but not authorised SHALL be reported as such with the step to authorise it.

#### Scenario: Several devices
- **WHEN** two devices are ready and `ANDROID_SERIAL` is not set
- **THEN** the command stops and lists the serial numbers

#### Scenario: Unauthorised device
- **WHEN** the only device is listed as unauthorised
- **THEN** the command stops and tells the person to unlock it and accept the USB debugging prompt

### Requirement: Synchronise with the base branch first
`review` SHALL bring in the remote copy of the feature branch with a fast-forward pull, then merge the current base branch into it before the person tests, and SHALL re-run QA if either brought anything.

#### Scenario: Base moved
- **WHEN** the base branch has new commits since the build
- **THEN** it is merged into the feature branch, QA re-runs, and a conflict that cannot be resolved cleanly stops the review with a clear message

#### Scenario: Branch pushed from another machine
- **WHEN** the remote branch has commits the local one does not
- **THEN** they are brought in before the base is merged, so the person tests the current code

### Requirement: Starting the review claims the issue
When the review starts and the base-branch synchronisation succeeds, `review` SHALL replace `built` with `in-review`, which frees the assignee's capacity.

#### Scenario: Review starts
- **WHEN** the person starts `review` on a `built` issue and the synchronisation succeeds
- **THEN** the issue is labelled `in-review`

#### Scenario: Synchronisation fails
- **WHEN** the base-branch merge cannot be completed
- **THEN** the issue stays `built` and the person is told why

### Requirement: The person drives, the agent observes
By default the agent SHALL NOT tap, type, swipe or otherwise automate the app or the device, and SHALL NOT use UI automation or monkey tools; it only observes. Only when `review.autopilot` is `precheck` or `verify` may it drive the app, within the limits of the requirement on operating the app. Actions in third-party apps that send messages SHALL be performed only by a person.

#### Scenario: Forbidden automation
- **WHEN** the agent is about to issue an input command to the device and `review.autopilot` is `off`
- **THEN** it does not, and asks the person to do it

#### Scenario: Autopilot on
- **WHEN** `review.autopilot` is `precheck`
- **THEN** the agent may drive the app only through semantic finders or the runner's own browser

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

### Requirement: Capture names are plain file names
Capture names SHALL consist of letters, digits, `_`, `-` and `.` only. A name containing a path or `..` SHALL be rejected, so a capture can never be written outside the evidence directory.

#### Scenario: Path in the name
- **WHEN** the person writes `capture ../../x`
- **THEN** the capture is rejected with the allowed characters and nothing is written

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

### Requirement: Log audit covers only the app under review
The log audit SHALL read only the log lines written by the processes of the application under review, identified by its application id, and SHALL NOT audit or quote lines from other applications on the device. When the log does not name the application's process, the verdict SHALL be `REVIEW INCONCLUSIVE`.

#### Scenario: Another app logs an error
- **WHEN** another application on the device logs an unhandled exception and the application under review logs none
- **THEN** the verdict is `REVIEW PASSED` and the report does not quote the other application's line

#### Scenario: The application's process is not in the log
- **WHEN** the log never names the process of the application under review
- **THEN** the verdict is `REVIEW INCONCLUSIVE` and the output and the report say why

### Requirement: Functional bugs go through the spec
A functional or UX defect found during review SHALL NOT be patched live. The agent SHALL direct the person to `/relevo:fix`.

#### Scenario: Bug found
- **WHEN** the person reports that a scenario fails
- **THEN** the agent does not edit code and points to `/relevo:fix`

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

### Requirement: Evidence policy
When `evidence.policy` is `local_only`, screenshots SHALL NOT be attached to the pull request or issue and SHALL be deleted at the end. When it is `attach_to_pr`, the review SHALL tell the person which files to attach and SHALL keep them until the person confirms. The review cannot upload images itself, because GitHub offers no API for attaching images to a pull request description, so the person drags them in.

#### Scenario: Sensitive project
- **WHEN** `evidence.policy` is `local_only`
- **THEN** the pull request contains no images and the evidence directory is removed

#### Scenario: Screenshots attached by the person
- **WHEN** `evidence.policy` is `attach_to_pr` and the pull request is open
- **THEN** the review lists the screenshot files to drag into the description, keeps the evidence directory, and removes it only after the person says they attached them

### Requirement: Evidence is never committed
The evidence directory SHALL be ignored by git. If it is not, the review SHALL stop before capturing anything.

#### Scenario: Evidence directory not ignored
- **WHEN** the repository does not ignore the evidence directory
- **THEN** the review stops and tells the person to add it to the ignore file

### Requirement: The review can be resumed
The review SHALL keep its checklist, captures and audit result on disk, so an interrupted review continues where it stopped.

#### Scenario: Interrupted review
- **WHEN** the person starts the review again for an issue that is already `in-review` and has saved state
- **THEN** the review resumes with the confirmed lines and captures it already had

#### Scenario: Review after a fix
- **WHEN** a fix changed the specification of an issue whose review is in progress
- **THEN** confirmed lines stay confirmed, failed lines and new scenarios become pending, and the log audit and the person's agreement must be repeated

#### Scenario: Retesting a confirmed line
- **WHEN** the person asks to retest a line that was already confirmed
- **THEN** that line becomes pending again

### Requirement: Safe push
Before pushing, `review` SHALL scan the diff against the base branch for temporary markers and credential patterns and abort on a match.

#### Scenario: Credential in diff
- **WHEN** the diff contains a credential pattern
- **THEN** the push is aborted and the file is named

### Requirement: Review uses the platform of the issue when QA runs again
When `review` launches `relevo:qa` again after bringing in changes from the base branch, it SHALL resolve the platform of the issue from its text and give QA the profile and the folder of the platform, as `go` does.

#### Scenario: QA after the sync
- **WHEN** the merge from the base branch brought in changes and the issue is for `web`
- **THEN** QA receives the profile of the stack of `web` and its folder

### Requirement: The review starts with a short brief
Before the shot list, `review` SHALL show a brief generated by a script with fixed caps: the title, what was asked (at most two sentences of the summary), the outcome, the risk to check first and the number of checklist lines. The brief SHALL be computed, not written by the model.

#### Scenario: Brief shown first
- **WHEN** the review starts
- **THEN** the brief appears before the shot list and checklist, in about six lines

#### Scenario: Long summary
- **WHEN** the summary has ten sentences
- **THEN** the brief holds only the first two

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
Only the person SHALL be able to waive a finding, one at a time, with `waive <number> <reason>` and a non-empty reason; the agent SHALL NOT propose or apply one. When every finding is waived the verdict SHALL be `REVIEW PASSED (with waivers)`, which allows the pull request, and the waived findings with their reasons SHALL appear in the report and the pull request body. A finding not waived SHALL still block.

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

### Requirement: The review picks its adapter from the platform and the target
`review` SHALL resolve, from the platform of the issue and its target, how the review obtains its log and captures and whether it can be driven: a device with `adb` for Flutter on `android`, a simulator with `xcrun` for Flutter on `ios` (macOS only), a browser for `web`. A combination without an adapter SHALL stop the review before it changes anything, naming what is missing.

#### Scenario: Android device
- **WHEN** the platform is Flutter with the target `android`
- **THEN** the adapter is the device with `adb`, and the review proceeds as before

#### Scenario: Web
- **WHEN** the platform is Vue with the target `web`
- **THEN** the adapter is the browser, and the review needs `review.autopilot` other than `off`

#### Scenario: No adapter
- **WHEN** the combination has no adapter, or the tool it needs is missing
- **THEN** `review` stops before changing anything and says what to install or that it is not supported yet

### Requirement: Who drives the review is a setting, and the person always closes the loop
`review.autopilot` SHALL be `off` (the person does everything), `precheck` (the agent walks the lines, takes captures, audits and records its result per line apart from the person's confirmation; the person confirms every line) or `verify` (as `precheck`, and the agent may mark a line `ok (auto)` only when its `THEN` was verified by an assertion, a semantic finder or the log; the person confirms the rest and gives the agreement). The pull request SHALL list the lines verified automatically.

#### Scenario: Precheck
- **WHEN** `review.autopilot` is `precheck` and the agent's walk passes line 2
- **THEN** line 2 is recorded as pre-checked and stays pending until the person confirms it

#### Scenario: Verify
- **WHEN** `review.autopilot` is `verify` and an assertion proved the `THEN` of line 3
- **THEN** line 3 is `ok (auto)`, the person confirms the remaining lines and agrees, and the pull request lists line 3 as verified automatically

#### Scenario: Auto in a mode that does not allow it
- **WHEN** an automatic confirmation is attempted in `off` or `precheck`
- **THEN** it is refused and the line stays as it was

### Requirement: The agent operates the app only within fixed limits
The agent SHALL operate the app only when `review.autopilot` is not `off`: on mobile targets through semantic finders, on the web in the runner's own clean browser and against allowed origins. It SHALL NOT use coordinates, `adb shell input`, Appium, Maestro, the person's browser or third-party sites, and SHALL first obtain the person's written confirmation that the app points to non-production data.

#### Scenario: Autopilot off
- **WHEN** `review.autopilot` is `off`
- **THEN** the agent does not operate the app

#### Scenario: Origin not allowed
- **WHEN** a driven web page tries to load an origin that is not `localhost` or listed in `review.allowed_origins`
- **THEN** the request is blocked and recorded

#### Scenario: Production data
- **WHEN** the person does not confirm that the app points to non-production data
- **THEN** the agent does not start

### Requirement: A web review script is reviewed before it runs
The script that drives a browser SHALL be written from the scenarios, reviewed by `qa` in read-only mode, and refused by the runner if it imports anything other than the assertion and browser libraries or reaches the file system, the network outside the browser or the process. Lines it cannot check (appearance, animation, fidelity to an image) SHALL stay for the person.

#### Scenario: Script reaches the file system
- **WHEN** the script imports `node:fs` or `child_process`
- **THEN** the runner refuses it before launching a browser

#### Scenario: A line that cannot be asserted
- **WHEN** a scenario is about how something looks
- **THEN** it has no assertion and stays for the person

### Requirement: Credentials of a driven review are names, not values
A driven review that needs a login SHALL read test credentials only through environment variable names the person provides, and SHALL NOT read, print or store their values; the runner SHALL redact any such value from what it writes.

#### Scenario: Value in the output
- **WHEN** a page echoes the test password in an error message
- **THEN** the runner writes it as redacted

### Requirement: The audit understands a browser
The audit SHALL treat console errors, uncaught exceptions, unhandled rejections and failed requests of a driven browser as findings, and an empty browser log as inconclusive.

#### Scenario: Console error
- **WHEN** the driven page logs an uncaught exception
- **THEN** the verdict is `REVIEW REJECTED` with the exception as a finding

### Requirement: Review restores the base branch upon completion
When `review` opens the pull request and cleans up evidence, it SHALL switch the repository working tree back to the base branch only when it runs in the main checkout and the base branch is not checked out in another worktree. Otherwise it SHALL leave the branch as it is and say so. A failure to switch SHALL NOT change the verdict or the state of the issue.

#### Scenario: Pull request opened successfully
- **WHEN** the pull request is created at the conclusion of a review in the main checkout
- **THEN** `review` switches the repository working tree back to the base branch

#### Scenario: Review runs in a separate worktree
- **WHEN** the pull request is created and the review runs in a worktree, or the base branch is checked out elsewhere
- **THEN** `review` does not switch branches, tells the person which branch the worktree stays on, and the report is unchanged
