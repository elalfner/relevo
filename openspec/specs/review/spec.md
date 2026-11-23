# review Specification

## Purpose
TBD - created by archiving change relevo-v1. Update Purpose after archive.

## Requirements

### Requirement: Local session with a device
`review` SHALL run in a local session. When the adapter of the platform is a device, it SHALL need a connected device and, when none is connected, SHALL stop and say so. An adapter of another kind needs no device.

#### Scenario: No device
- **WHEN** the adapter is a device and no device appears in the device list
- **THEN** the command stops with instructions to connect one

#### Scenario: Adapter without a device
- **WHEN** the adapter of the platform is the `api` one and no device is connected
- **THEN** the review does not look for a device and goes on

### Requirement: Choosing the device
When several devices are ready, `review` SHALL use the one named by `ANDROID_SERIAL` and otherwise stop and list them. A device that is connected but not authorised SHALL be reported as such with the step to authorise it.

#### Scenario: Several devices
- **WHEN** two devices are ready and `ANDROID_SERIAL` is not set
- **THEN** the command stops and lists the serial numbers

#### Scenario: Unauthorised device
- **WHEN** the only device is listed as unauthorised
- **THEN** the command stops and tells the person to unlock it and accept the USB debugging prompt

### Requirement: Synchronise with the base branch first
`review` SHALL bring in the remote copy of the feature branch with a fast-forward pull, then merge the current base branch into it before the person tests, and SHALL re-run QA if either brought anything. When the merge conflicts and every conflicted file is inside the folder of the platform or the change folder, `review` SHALL hand the conflict to the developer agent and run QA before the person tests.

#### Scenario: Base moved
- **WHEN** the base branch has new commits since the build
- **THEN** it is merged into the feature branch, QA re-runs, and a conflict that cannot be resolved cleanly is handled as the scenarios below say

#### Scenario: Branch pushed from another machine
- **WHEN** the remote branch has commits the local one does not
- **THEN** they are brought in before the base is merged, so the person tests the current code

#### Scenario: The agent resolves a conflict
- **WHEN** the merge conflicts in files inside the folder of the platform
- **THEN** the developer agent receives the conflicted files and the scenarios of the issue, keeps the behaviour of both sides and adds a test that fails if either side is lost where the platform allows, QA runs, and the review goes on

#### Scenario: The conflict cannot be resolved
- **WHEN** the developer agent cannot resolve the conflict, or QA still rejects after the retries
- **THEN** `review` aborts the merge, leaves the branch as it was and stops with a clear message that names the conflicted files

#### Scenario: A conflict outside the folder of the platform
- **WHEN** a conflicted file is outside the folder of the platform and the change folder
- **THEN** `review` does not hand it to the developer agent, aborts the merge and stops with a clear message

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
When `evidence.policy` is `local_only`, screenshots SHALL NOT be attached to the pull request or issue and SHALL be deleted at the end. When it is `attach_to_pr`, the review SHALL tell the person which image files to attach, from every run folder of the evidence directory and no other file, and SHALL keep them until the person confirms; when there is no image, the evidence directory SHALL be deleted without asking. The review cannot upload images itself, because GitHub offers no API for attaching images to a pull request description, so the person drags them in.

#### Scenario: Sensitive project
- **WHEN** `evidence.policy` is `local_only`
- **THEN** the pull request contains no images and the evidence directory is removed

#### Scenario: Screenshots attached by the person
- **WHEN** `evidence.policy` is `attach_to_pr` and the pull request is open
- **THEN** the review lists only the PNG files, including those of extra run folders, keeps the evidence directory, and removes it only after the person says they attached them

#### Scenario: No screenshots
- **WHEN** `evidence.policy` is `attach_to_pr` and the evidence directory holds no image
- **THEN** the review deletes it without asking and says there was nothing to attach

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
When `review` runs QA again after bringing in changes from the base branch, it SHALL resolve the platform of the issue from its text and give the gate and the lenses the profile and the folder of the platform, as `go` does.

#### Scenario: QA after the sync
- **WHEN** the merge from the base branch brought in changes and the issue is for `web`
- **THEN** the gate and the lenses receive the profile of the stack of `web` and its folder

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
`review` SHALL resolve, from the platform of the issue and its target, how the review obtains its log and captures and whether it can be driven: a device with `adb` for Flutter on `android`, a simulator with `xcrun` for Flutter and for a SwiftUI stack on `ios` (macOS only), a browser for `web`, and the `api` adapter for a stack with no targets that has one (Laravel and Supabase, or a stack the plugin ships no adapter for whose repository profile declares it). A combination without an adapter SHALL stop the review before it changes anything, naming what is missing, which adapters exist and what the person can do next. When the adapter is a browser and `review.autopilot` is `off`, the stop message SHALL recommend `verify`, with `precheck` as the cautious option, in the language of `relevo.yml`.

#### Scenario: Android device
- **WHEN** the platform is Flutter with the target `android`
- **THEN** the adapter is the device with `adb`, and the review proceeds as before

#### Scenario: iOS simulator
- **WHEN** the platform is Flutter or a SwiftUI stack with the target `ios`
- **THEN** the adapter is the iOS Simulator with `xcrun`, the person drives the app in it, and the review does not need `review.autopilot` other than `off`

#### Scenario: iOS on a machine that is not macOS
- **WHEN** the platform has the target `ios` and the machine has no `xcrun`
- **THEN** `review` stops before changing anything and says that the iOS review needs macOS with Xcode

#### Scenario: Web
- **WHEN** the platform is Vue with the target `web`
- **THEN** the adapter is the browser, and the review needs `review.autopilot` other than `off`

#### Scenario: Web with autopilot off
- **WHEN** the platform is Vue with the target `web` and `review.autopilot` is `off`
- **THEN** the review stops before changing anything, recommends `verify` and names `precheck` as the cautious option, and says that the person still confirms every line and that lines about appearance are never marked automatically

#### Scenario: Laravel
- **WHEN** the platform has the stack `laravel`, which defines no targets
- **THEN** the adapter is `api`, and the review does not need `review.autopilot` other than `off`

#### Scenario: Supabase
- **WHEN** the platform has the stack `supabase`, which defines no targets
- **THEN** the adapter is `api`, driven by `supabase test db`, and the review does not need `review.autopilot` other than `off`

#### Scenario: Declared adapter
- **WHEN** the platform has a stack the plugin ships no adapter for, the repository's profile of that stack declares the `api` adapter in its `review` block, and the platform defines no target
- **THEN** the adapter is `api`, marked as declared by the repository, its log, test and needs are the ones of that block, and the review does not need `review.autopilot` other than `off`

#### Scenario: Declared adapter with an invalid profile
- **WHEN** the repository's profile of the stack declares the `api` adapter but cannot be resolved (for example, it has no `test`)
- **THEN** the review stops before changing anything, shows what is wrong with the profile and says that the issue stays `built`

#### Scenario: No adapter
- **WHEN** the combination has no adapter, or the tool it needs is missing
- **THEN** `review` stops before changing anything, says what to install or that it is not supported yet, names the adapters that exist (Flutter on Android, Flutter and SwiftUI on iOS, Flutter on web, Vue on web, Laravel and Supabase), says that the issue stays `built`, says that a stack the plugin ships can tune its review in its profile, and says that a stack of the repository with no targets can declare an `api` adapter in its own profile

### Requirement: Who drives the review is a setting, and the person always closes the loop
`review.autopilot` SHALL be `off` (the person does everything), `precheck` (the agent walks the lines, takes captures, audits and records its result per line apart from the person's confirmation; the person confirms every line) or `verify` (as `precheck`, and the agent may mark a line `ok (auto)` only when its `THEN` was verified by an assertion, a semantic finder, the log or the exit code of a project command; the person confirms the rest and gives the agreement). A line checked only by reading code, CI configuration or documentation SHALL be pre-checked, never marked automatically. The pull request SHALL list the lines verified automatically.

#### Scenario: Precheck
- **WHEN** `review.autopilot` is `precheck` and the agent's walk passes line 2
- **THEN** line 2 is recorded as pre-checked and stays pending until the person confirms it

#### Scenario: Verify
- **WHEN** `review.autopilot` is `verify` and an assertion proved the `THEN` of line 3
- **THEN** line 3 is `ok (auto)`, the person confirms the remaining lines and agrees, and the pull request lists line 3 as verified automatically

#### Scenario: Verified by a project command
- **WHEN** `review.autopilot` is `verify` and line 4 says the project builds, and the project's build command exits 0
- **THEN** line 4 is `ok (auto)` with the command and its exit code as what proved it

#### Scenario: Checked by reading code
- **WHEN** `review.autopilot` is `verify` and line 5 is checked by reading a CI workflow
- **THEN** line 5 is pre-checked with what was found and stays pending until the person confirms it

#### Scenario: Auto in a mode that does not allow it
- **WHEN** an automatic confirmation is attempted in `off` or `precheck`
- **THEN** it is refused and the line stays as it was

### Requirement: The agent operates the app only within fixed limits
The agent SHALL operate the app only when `review.autopilot` is not `off`: on mobile targets through semantic finders, on the web in the runner's own clean browser and against allowed origins. It SHALL NOT use coordinates, `adb shell input`, Appium, Maestro, the person's browser or third-party sites, and SHALL first obtain the person's written confirmation that the app points to non-production data. The browser runner SHALL itself refuse to start a browser when there is no review in progress, `review.autopilot` is `off`, that confirmation is missing or the person has already agreed to open the pull request.

#### Scenario: Autopilot off
- **WHEN** `review.autopilot` is `off`
- **THEN** the agent does not operate the app

#### Scenario: Origin not allowed
- **WHEN** a driven web page tries to load an origin that is not `localhost` or listed in `review.allowed_origins`
- **THEN** the request is blocked and recorded

#### Scenario: Production data
- **WHEN** the person does not confirm that the app points to non-production data
- **THEN** the agent does not start

#### Scenario: The runner checks the gates itself
- **WHEN** the browser runner is started while the review state is missing, says `autopilot: off`, or has no confirmation of the data
- **THEN** it exits with the reason before any browser starts, and no page is loaded

#### Scenario: Review already agreed
- **WHEN** the browser runner is started after the person agreed to open the pull request
- **THEN** it exits saying the review is closed, and no page is loaded

### Requirement: A web review script is reviewed before it runs
The script that drives a browser SHALL be written from the scenarios, reviewed by `qa` in read-only mode, and refused by the runner if it imports anything other than the assertion and browser libraries or reaches the file system, the network outside the browser or the process. Reaching the file system includes taking a screenshot other than through the runner's capture helper and any browser call that saves or uploads a file. The runner SHALL run only the exact script that `qa` passed: any change after the pass needs a new pass. Lines it cannot check (appearance, animation, fidelity to an image) SHALL stay for the person.

#### Scenario: Script reaches the file system
- **WHEN** the script imports `node:fs` or `child_process`
- **THEN** the runner refuses it before launching a browser

#### Scenario: Direct screenshot
- **WHEN** the script takes a screenshot of the page or of an element itself, with or without a path
- **THEN** the runner refuses it before launching a browser, and names the capture helper as the way to take one

#### Scenario: Other file access through the browser
- **WHEN** the script saves a PDF, a trace, a video, a HAR, a download or the storage state, uploads a local file to the page, or passes a file path to any browser call
- **THEN** the runner refuses it before launching a browser

#### Scenario: Script edited after QA
- **WHEN** the agent changes one port in a script that `qa` passed and runs it
- **THEN** the runner refuses it until `qa` passes the changed script

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
When `review` opens the pull request and cleans up evidence, it SHALL switch the repository working tree back to the base branch only when it runs in the main checkout, the base branch is not checked out in another worktree, and no server of the address under review runs from the working tree. Otherwise it SHALL leave the branch as it is and say why. A failure to switch SHALL NOT change the verdict or the state of the issue.

#### Scenario: Pull request opened successfully
- **WHEN** the pull request is created at the conclusion of a review in the main checkout and no dev server runs from the working tree
- **THEN** `review` switches the repository working tree back to the base branch

#### Scenario: Review runs in a separate worktree
- **WHEN** the pull request is created and the review runs in a worktree, or the base branch is checked out elsewhere
- **THEN** `review` does not switch branches, tells the person which branch the worktree stays on, and the report is unchanged

#### Scenario: The person's dev server runs from the working tree
- **WHEN** the pull request is created and the server answering the address under review runs from the working tree
- **THEN** `review` does not switch branches, says that switching would break that server, and tells the person to stop it before switching themselves

#### Scenario: The server's folder cannot be known
- **WHEN** the review cannot tell where the server of the address under review runs from
- **THEN** `review` does not switch branches and says why

### Requirement: A browser review takes captures through the runner
When `review.autopilot` is `precheck` or `verify`, the review script SHALL take screenshots only through a capture helper of the runner that takes a plain capture name and an assertion of the state the shot shows. The helper SHALL run the assertion first and take no screenshot when it fails, save `<name>.png` in the run's output folder, and give nothing back to the script. The runner SHALL print only the saved paths and record every capture in the review state.

#### Scenario: Capture saved
- **WHEN** the script captures `02_missing_var` with an assertion that the alert names the missing variable, and the assertion holds
- **THEN** `02_missing_var.png` is written in the output folder, the runner prints its path and nothing of its content, and the review state lists it

#### Scenario: Mislabelled capture
- **WHEN** the script captures `02_missing_var` but the page shows another error, so the assertion fails
- **THEN** no file is written, and the runner reports the capture as failed with the assertion's message

#### Scenario: Bad capture name
- **WHEN** the script calls the capture helper with `../../x`
- **THEN** the call fails with the allowed characters and nothing is written

#### Scenario: Captures and the pull request
- **WHEN** `evidence.policy` is `attach_to_pr` and the browser review took captures
- **THEN** the pull request body holds no image and the review lists the PNG files for the person to drag in

### Requirement: Each capture proves the state it shows
Every capture name SHALL be on the shot list, and its assertion SHALL tell its state apart from the other shots of the list. `qa` SHALL reject a review script whose capture name is not on the shot list or whose assertion would also hold for another shot.

#### Scenario: Capture not on the shot list
- **WHEN** QA reads a review script whose capture name is not on the shot list
- **THEN** QA rejects the script

#### Scenario: Assertion that cannot tell two shots apart
- **WHEN** two captures of the shot list both assert only that an alert is visible
- **THEN** QA rejects the script and asks for an assertion on what each alert says

### Requirement: Captures belong to the open review
Captures SHALL be taken while the person tests, before the agreement to open the pull request. Recording a capture after the agreement SHALL be refused. A synchronisation after a fix reopens the review and allows captures again.

#### Scenario: Capture after the agreement
- **WHEN** a capture is recorded after the person agreed to open the pull request
- **THEN** it is refused, and the state's captures are unchanged

#### Scenario: Screenshots asked for after the pull request
- **WHEN** the person asks for the shot list after the pull request is open
- **THEN** the review points to the captures already taken during the walk and does not drive again

### Requirement: The review script's output does not reach the agent
The console output of the review script SHALL NOT be passed to the runner's output. The runner SHALL write it, with every secret value redacted, to a file in the run's output folder.

#### Scenario: Script prints
- **WHEN** the review script writes to the console
- **THEN** the runner's output does not contain it, and the file in the output folder holds it redacted

### Requirement: A failing page is reported as such
When the review script fails outside a line, the runner SHALL name first, as the probable cause, the page's own failure seen during the run: an uncaught error of the page or a response of 400 or more from the address under review.

#### Scenario: A module answers 500
- **WHEN** a module of the page answers 500 and the script then times out waiting for an element
- **THEN** the runner's message names the 500 response and its address before the timeout

### Requirement: Several browser runs keep separate evidence
Each run of the browser runner SHALL write its log and result to its own output folder, and all runs of one review SHALL share one review state. A run against a server started with another configuration SHALL use an output folder of its own. The log audit SHALL read only the log of the normal run, because the other runs produce errors on purpose.

#### Scenario: Run with another configuration
- **WHEN** the agent runs the review script against a second server on another localhost port with its own output folder
- **THEN** the log and result of the normal run are unchanged, and the captures of both runs are in the review state

#### Scenario: Overwrite of the normal log
- **WHEN** the runner is started with the default output folder and a log is already there
- **THEN** it warns that the previous log is replaced

#### Scenario: Audit of the normal run
- **WHEN** the review reaches the log audit after runs with another configuration
- **THEN** only the log of the normal run is audited

### Requirement: A browser review checks its tools and the app before driving
Before the first run, a browser review SHALL check that the project's dependencies are installed and match its lock file, that the browser library and its browser resolve from the project, and that the address under review and the module scripts its page loads from the same origin answer with a status below 400. The browser library is a dependency of the project: the review SHALL NOT install it, and SHALL point the person to `init` when it is missing. The browser itself MAY be installed only with the person's permission.

#### Scenario: Dependencies missing
- **WHEN** the project has no installed dependencies
- **THEN** the review does not drive, and offers the frozen install of the project's lock file as the requirement "A browser review offers a frozen install of the project's dependencies" describes

#### Scenario: Dependencies stale
- **WHEN** dependencies are installed, but the lock file names a package version that is not the one installed (for example after the merge with the base branch changed the lock file)
- **THEN** the review does not drive, says the installed dependencies do not match the lock file, and offers the frozen install

#### Scenario: Browser library missing
- **WHEN** the browser library does not resolve from the project
- **THEN** the review installs nothing, says the library is missing from the project's development dependencies, names `/relevo:init` and the exact install command, and stops without driving

#### Scenario: Browser missing
- **WHEN** the browser library resolves but its browser is not installed
- **THEN** the review asks the person for permission, installs the browser only on a yes, and checks again

#### Scenario: App not answering
- **WHEN** the address under review, or a module script of its page, does not answer or answers with a status of 400 or more
- **THEN** the review tells the person the exact command to start the app, with the names of the environment variables it needs, and waits

### Requirement: The brief proposes the automatic walk
When `review.autopilot` is `precheck` or `verify`, the brief SHALL say, before the person tests, which checklist lines the agent walks itself and how: a browser assertion, a project command, reading code, CI or docs, or a run against a server with another configuration. It SHALL say that the person confirms every line and that lines about appearance are never marked automatically, in the language of `relevo.yml`.

#### Scenario: Plan shown up front
- **WHEN** a browser review with `review.autopilot` `precheck` starts
- **THEN** the brief lists each line the agent will walk with its method, and the lines left to the person

### Requirement: Project commands in a review leave tracked files unchanged
A project command run to check a line SHALL NOT change tracked files. When one does, the review SHALL restore those files and report which ones changed. Commands that rewrite files by design (fixing or formatting) SHALL NOT be run.

#### Scenario: A command rewrites a file
- **WHEN** the project's lint command changes a tracked file
- **THEN** the file is restored and the person is told which file changed

### Requirement: Servers started by the agent are its own
For a line that needs the app started with another configuration, the agent SHALL start its own server through a script that takes a free localhost port, refuses a busy one, never lets the server move to another port, records it, waits until it answers, and stops only servers it recorded. The server the person started SHALL NOT be stopped or restarted. These configurations SHALL be listed before the person confirms the data.

#### Scenario: Missing variable
- **WHEN** a line says the app shows an error when a variable is missing, and no environment file that the dev server loads by itself exists
- **THEN** the agent starts a second server on a free port without that variable, waits until it answers, runs the review script against it with its own output folder, and stops that server afterwards

#### Scenario: Busy port
- **WHEN** the port asked for is already in use
- **THEN** no server is started and the script says the port is busy

#### Scenario: Stopping a server not started by the agent
- **WHEN** a stop is asked for a port whose server the script did not record
- **THEN** nothing is stopped, and the server the person started is still running and untouched

### Requirement: Environment files of a reviewed app are never read
Variable names for a server with another configuration SHALL come from the example environment file or the specification. The real environment files SHALL never be read; the review MAY only check whether they exist.

#### Scenario: An environment file exists
- **WHEN** a line needs a variable to be missing and an environment file that the dev server loads by itself exists
- **THEN** the line is not run against an extra server; it is pre-checked by reading the code or left for the person, and the review says why without reading the file

### Requirement: An uncommitted configuration is named
When `relevo.yml` has uncommitted changes, the review SHALL say so before it starts, use the file as it is, and say that the change belongs on the base branch through its own commit. The review SHALL NOT commit `relevo.yml` to the branch of the issue.

#### Scenario: Autopilot set for this review
- **WHEN** the person set `review.autopilot` in `relevo.yml` and did not commit it
- **THEN** the review warns that the setting is not committed and belongs on the base branch, runs with it, and the pull request of the issue does not include `relevo.yml`

### Requirement: A browser review offers a frozen install of the project's dependencies
When dependencies are missing or stale, the review SHALL show the frozen install command for the project's lock file, which runs no package scripts, and SHALL run it only after the person confirms. It SHALL NOT run package scripts, change the manifest or the lock file, or retry another way after a failure. With no lock file it SHALL install nothing.

#### Scenario: npm lock file, person accepts
- **WHEN** dependencies are missing, the platform folder has `package-lock.json`, and the person says yes to `npm ci --ignore-scripts`
- **THEN** the review runs that command in the platform folder, checks the tools again, and continues only when the check passes

#### Scenario: Other package managers
- **WHEN** the platform folder has `pnpm-lock.yaml` or `yarn.lock` instead
- **THEN** the offered command is `pnpm install --frozen-lockfile --ignore-scripts` or `yarn install --immutable` respectively

#### Scenario: Person declines
- **WHEN** the person says no to the install
- **THEN** nothing is installed, the review does not drive, and the issue stays in the state it had

#### Scenario: No lock file
- **WHEN** dependencies are missing and the platform folder has no lock file
- **THEN** the review installs nothing, says there is no lock file to install from, and asks the person to install the dependencies themselves

#### Scenario: Install fails
- **WHEN** the confirmed install exits with an error
- **THEN** the review shows the error, does not retry with package scripts or another command, does not drive, and leaves the manifest and the lock file unchanged

#### Scenario: A running dev server
- **WHEN** the install replaces the dependencies while the person's dev server is running
- **THEN** the review tells the person to restart their dev server before it checks the address, and never restarts it itself

### Requirement: An api review has no device and no capture
For the `api` adapter the review SHALL need no device, no browser and no capture, and SHALL brief the person with the checklist and without a shot list. The person SHALL confirm every checklist line in every autopilot mode. With `review.autopilot` `off` the person runs the project's tests and writes the result of each line; the agent only records and audits.

#### Scenario: Autopilot off
- **WHEN** the adapter is `api` and `review.autopilot` is `off`
- **THEN** the review starts, the brief has the checklist and no shot list, the agent runs no test, and the person's `ok`, `fail` and `ran` lines are recorded

#### Scenario: Capture asked for
- **WHEN** the person asks for a capture in an `api` review
- **THEN** the agent says that this adapter takes none and records nothing

### Requirement: The agent proves a line of an api review with an existing test
With `review.autopilot` `precheck` or `verify`, the agent SHALL prove a line of an `api` review only by running the test that already covers its scenario (a feature test selected by a filter, or, for Supabase, a pgTAP file passed to `supabase test db`), never by writing or editing a test, and SHALL record the filter or file it used, the number of tests or assertions that ran and the exit code. A run that matched no test or no file, or whose pgTAP plan ran no assertion, SHALL be a failed proof. For Supabase the agent SHALL also record the names of the assertions of the file that cover the `THEN` of the line, and the proof SHALL fail unless the run has at least one covered name, every covered name appears in the pgTAP file and none of them is among the failing assertions of the run; the pull request SHALL list the covered names for each line proved. With `verify` a line SHALL be marked `ok (auto)` only when the exit code proves its `THEN`; a line with no covering test, or one whose test does not assert its `THEN`, SHALL stay for the person.

#### Scenario: A test covers the line
- **WHEN** `review.autopilot` is `verify` and the test for line 2 ran once and exited 0
- **THEN** line 2 is `ok (auto)` and the pull request lists it with the test name

#### Scenario: A pgTAP file covers the line
- **WHEN** `review.autopilot` is `verify`, the platform is Supabase and `supabase test db supabase/tests/orders_rls.test.sql` ran 4 assertions, exited 0 and the run names the assertion `anon cannot insert orders` of that file as covering the line
- **THEN** the line that file covers is `ok (auto)` and the pull request lists it with the file, the count and the covered name

#### Scenario: Precheck
- **WHEN** `review.autopilot` is `precheck` and the test for line 2 exited 0
- **THEN** line 2 is recorded as pre-checked and stays pending until the person confirms it

#### Scenario: A filter that matches nothing
- **WHEN** the filter matched no test, the file does not exist, or the pgTAP file ran no assertion
- **THEN** the proof fails, the line stays pending and the agent says no test was found

#### Scenario: No test for the line
- **WHEN** no test of the project covers a line
- **THEN** the agent does not write one, and the line is left to the person with a note that it has no test

#### Scenario: A pgTAP run that names no covering assertion
- **WHEN** the platform is Supabase and the run for the line exited 0 with assertions but names none as covering it
- **THEN** `precheck` and `auto` refuse the line and say that a covering assertion must be named

#### Scenario: A covered name that is not in the file
- **WHEN** the run names `anon cannot read invoices` as covering the line and the pgTAP file has no assertion with that name
- **THEN** the proof fails and the line stays for the person

#### Scenario: A covered assertion that failed
- **WHEN** the run names an assertion as covering the line and that assertion is among the failing ones
- **THEN** the proof fails, whatever the exit code of the other assertions

### Requirement: The audit of an api review reads the log since the review started
For the `api` adapter the audit SHALL read only what the project's log received since the review started, SHALL NOT truncate, delete, restart or recreate it, and SHALL report a source it could not read. When the log is made of files, the start SHALL be an offset per file recorded when the state is created, and a file that appears later SHALL be read from its start. When the log is a container's (`docker:<name>`) or the services of a Docker Compose project (`compose:<services>`), the start SHALL be a timestamp recorded when the state is created and the audit SHALL read what the container or the services wrote since then. The services of a Compose log SHALL be read one at a time, every service of the project when none is listed, and the output of one read SHALL be allowed at least 256 MiB. A service that cannot be read SHALL be reported by its own name with the reason, and SHALL NOT keep the audit from reading the others.

#### Scenario: Entries from before the review
- **WHEN** the log already had an unhandled exception before the review started and none after
- **THEN** the exception is not a finding

#### Scenario: Daily log
- **WHEN** the project writes `laravel-<date>.log` and a new file appears after the review started
- **THEN** the audit reads the new file from its start

#### Scenario: Container log
- **WHEN** the platform is Supabase and the review started at 10:00:00
- **THEN** the audit reads the log of the local database container from 10:00:00, and an error the container logged at 09:59 is not a finding

#### Scenario: Compose log
- **WHEN** a declared adapter has `review.log` `compose:postgres,auth` and the review started at 10:00:00
- **THEN** the audit reads what the services `postgres` and `auth` of the Compose project in the folder of the platform wrote from 10:00:00, one service at a time, and an error one of them logged at 09:59 is not a finding

#### Scenario: Every service
- **WHEN** a declared adapter has `review.log` `compose:` with no service
- **THEN** the audit lists the services of the Compose project and reads each of them since the review started

#### Scenario: Unreadable file
- **WHEN** a log file named by the setting cannot be read, or the container does not exist
- **THEN** the report says which source and why, and the verdict is not `REVIEW PASSED` on that source's account

#### Scenario: Unreadable compose log
- **WHEN** the `compose:` log of a declared adapter cannot be read (Docker does not answer, the folder has no Compose file, or a service does not exist)
- **THEN** the report says which source and why, and the verdict is `REVIEW INCONCLUSIVE`, which cannot be waived

#### Scenario: One service too large
- **WHEN** the log of the service `postgres` since the review started is larger than the read allows and the other services are readable
- **THEN** the report names `postgres` as the unreadable source, says that the buffer was exceeded, says that `reset-log` moves the start of the window and that the runs recorded so far then stop proving it, and the verdict is `REVIEW INCONCLUSIVE`

### Requirement: A recorded test run proves an api review whose log is quiet
For the `api` adapter, an empty log slice SHALL be `REVIEW INCONCLUSIVE` only when no test run is recorded in the review state, and SHALL be `REVIEW PASSED` when a run is recorded and the latest run of each line or filter exited 0, so a run repeated after a fix replaces the one before. A latest run with a non-zero exit code SHALL be `REVIEW REJECTED` and name the failing tests. The log slice SHALL still be scanned for unhandled exceptions, server errors and database errors. A run told by the person SHALL be recorded as the person's, and the pull request SHALL say which runs were the person's and which the agent's. When the start of the log was reset after runs were recorded, a run recorded before the reset SHALL NOT prove the new window: the verdict SHALL be `REVIEW INCONCLUSIVE`, saying that no run is recorded since the reset, until a run is recorded after it. A failing run recorded before the reset SHALL still stand until a later run of the same line or filter replaces it.

#### Scenario: Clean run, empty log
- **WHEN** a test run exited 0 and the log slice is empty
- **THEN** the verdict is `REVIEW PASSED`

#### Scenario: No run recorded
- **WHEN** no run is recorded and the log slice is empty
- **THEN** the verdict is `REVIEW INCONCLUSIVE` and the person is asked to run the tests and say so

#### Scenario: Failing run
- **WHEN** a recorded run exited non-zero
- **THEN** the verdict is `REVIEW REJECTED` and the report names the failing tests

#### Scenario: Run repeated after a fix
- **WHEN** a run for a line exited 1 and a later run for the same line exited 0
- **THEN** only the later run counts and the verdict can be `REVIEW PASSED`

#### Scenario: Error in the log
- **WHEN** a run exited 0 and the slice has an unhandled exception
- **THEN** the verdict is `REVIEW REJECTED` and the finding can be waived by the person with a reason

#### Scenario: Not waivable
- **WHEN** the person tries to waive an inconclusive audit of an `api` review
- **THEN** the waiver is refused

#### Scenario: Empty window after a reset
- **WHEN** a run exited 0, then the log was reset, then the audit runs with an empty slice and no run recorded since
- **THEN** the verdict is `REVIEW INCONCLUSIVE`, the reason says that no run is recorded since the log was reset, and it cannot be waived

#### Scenario: Run after the reset
- **WHEN** the log was reset and a run exiting 0 is recorded after it, and the slice is empty
- **THEN** the verdict is `REVIEW PASSED`

#### Scenario: Failing run before the reset
- **WHEN** a run for a line exited 1, then the log was reset, and no later run of that line is recorded
- **THEN** the verdict is `REVIEW REJECTED` and names the failing run

### Requirement: An api review checks its tools and the test database before running
Before an `api` review runs a test, the review SHALL check the tools of its stack without reading the real environment files. For Laravel it SHALL check that PHP and Composer can be found, that the installed dependencies match the lock file, and which database the test configuration declares; a database other than in-memory SQLite, or one the test configuration does not declare, SHALL need the person's written confirmation that it is not production before any test or server runs. For Supabase it SHALL check that the Supabase CLI can be found, that the Docker daemon answers, that `supabase/config.toml` exists and that the local stack is running; it SHALL need no confirmation about the database because the tests only ever run against the local containers. The review SHALL install and start nothing without showing it in the plan of the walk; for a missing tool or dependency it SHALL give the command for the person to run.

#### Scenario: In-memory SQLite
- **WHEN** the test configuration declares `sqlite` and `:memory:`
- **THEN** the check passes and no confirmation is asked

#### Scenario: Another database
- **WHEN** the test configuration declares a MySQL or PostgreSQL connection
- **THEN** the review names it, asks for the confirmation, and runs no test until the person gives it

#### Scenario: No database declared
- **WHEN** the test configuration declares no database
- **THEN** the review says the database is unknown and asks for the same confirmation

#### Scenario: Missing dependencies
- **WHEN** `vendor/` does not exist
- **THEN** the review stops, runs no installer and gives the Composer command for the person to run

#### Scenario: Supabase ready
- **WHEN** the CLI is found, Docker answers, `supabase/config.toml` exists and the local stack is running
- **THEN** the check passes and no confirmation is asked

#### Scenario: Docker not running
- **WHEN** the Supabase CLI is found and the Docker daemon does not answer
- **THEN** the review stops before running a test and tells the person to start Docker

#### Scenario: Local stack stopped
- **WHEN** the CLI and Docker are fine and the local stack is not running
- **THEN** the review says so; with `review.autopilot` `off` it asks the person to run `supabase start`, and with `precheck` or `verify` it lists `supabase start` in the plan of the walk and runs it only after the person confirms, and it stops only a stack it started

#### Scenario: Missing config
- **WHEN** `supabase/config.toml` does not exist in the folder of the platform
- **THEN** the review stops, runs nothing and says to run `supabase init` or to check the platform's path

### Requirement: An api review may start its own server on its own port
When the profile's `review` block names a `serve` command, the agent MAY, with `review.autopilot` `precheck` or `verify` and after the person confirmed the data, start that server on a free localhost port through the script that records and stops it, wait until its URL answers, and stop only the servers it recorded. Every server SHALL be listed in the plan of the walk before the person confirms. The review SHALL reach only `localhost` on that port. Without a `serve` command the agent SHALL start no server.

#### Scenario: Server configured
- **WHEN** `serve` is set, `review.autopilot` is `verify` and the data is confirmed
- **THEN** the agent starts it on a free port, waits for its URL, runs the lines that need it and stops it afterwards

#### Scenario: No serve
- **WHEN** the profile has no `serve` command
- **THEN** the agent starts no server, and the lines that need one are left to the person

#### Scenario: Another origin
- **WHEN** a line needs a request to an address that is not `localhost` on the port of the server
- **THEN** the agent does not make it, and `review.allowed_origins` does not widen an `api` review

#### Scenario: A server that was not the agent's
- **WHEN** a stop is asked for a server the agent did not start
- **THEN** nothing is stopped

### Requirement: A branch held by another worktree stops review before it changes anything
Before it switches to the branch of the issue, `review` SHALL check whether another worktree holds that branch. If one does, `review` SHALL stop with the issue left as `built`, without changing any file, label or comment, and SHALL name the worktree and its path and how to continue, instead of showing the error of git.

#### Scenario: A failed go left its worktree
- **WHEN** `review` runs for an issue whose branch is checked out in a worktree that a failed `go` kept
- **THEN** `review` stops, says that the branch is held by that worktree and gives its path, and the issue stays `built`

#### Scenario: Review in a worktree of its own
- **WHEN** the person runs `review` in a worktree where the branch of the issue is free
- **THEN** `review` switches to the branch there and goes on as in the main checkout

### Requirement: A Supabase review only touches the local database
For the `supabase` stack the review SHALL run `supabase test db` and `supabase db lint` only against the local containers. A command of the review SHALL NOT carry `--linked` or `--db-url`, SHALL NOT run `supabase link`, `supabase db push`, `supabase db pull`, `supabase db reset --linked` or any command that reaches a remote project, and SHALL NOT read `.env` files or `supabase/.temp`. A `review.test` that names one of those flags SHALL be refused.

#### Scenario: Linked project
- **WHEN** the folder of the platform is linked to a remote project
- **THEN** the review runs its tests against the local containers, never with `--linked`, and says nothing about the remote project

#### Scenario: Test command that targets a remote database
- **WHEN** `review.test` in `.relevo/stacks/supabase.md` is `supabase test db --linked`
- **THEN** resolving the profile fails and names the key

#### Scenario: Agent asked to push
- **WHEN** a line of the checklist says to apply the migration to the staging project
- **THEN** the agent does not run it, and the line is left to the person with a note that a review is local only

### Requirement: The audit of a Supabase review separates expected denials from errors
For the `supabase` stack the audit SHALL classify what the database container logged since the review started. `FATAL`, `PANIC`, a detected deadlock and an out-of-memory message SHALL be findings, except the single entry `FATAL:  role "postgres" does not exist`, which `supabase db reset` writes while it recreates the database: that entry SHALL be counted and listed in the report as an expected startup entry and SHALL NOT be a finding. An `ERROR` whose message is a permission denial (`permission denied`), a row-level security violation (`violates row-level security policy`) or a constraint violation (`violates ... constraint`, `duplicate key`) SHALL be counted and listed in the report as an expected denial and SHALL NOT be a finding while a recorded run exited 0. Any other `ERROR` SHALL be a finding. The audit SHALL NOT assume that a pgTAP test of a policy writes its denials to the log: a denial caught by `throws_ok` is not logged, and the report SHALL say that the proof of a denial is the recorded run and its assertions, not the log. The person MAY waive a finding with a reason, as in any `api` review.

#### Scenario: Denial provoked by a policy test
- **WHEN** a run exited 0 and the slice has three `new row violates row-level security policy` errors
- **THEN** the report lists three expected denials and the verdict can be `REVIEW PASSED`

#### Scenario: Policy test that logs nothing
- **WHEN** a run exited 0 with assertions and the slice has only `create extension` and `drop extension` statements
- **THEN** the verdict can be `REVIEW PASSED` and the report says that no denial appears in the log and that the run is the proof

#### Scenario: Denials with a failing run
- **WHEN** a run exited non-zero and the slice has `permission denied` errors
- **THEN** the verdict is `REVIEW REJECTED` on the run, and the report names the failing assertions

#### Scenario: Other error
- **WHEN** a run exited 0 and the slice has `ERROR: relation "orders" does not exist` or a syntax error
- **THEN** the verdict is `REVIEW REJECTED` and the finding can be waived by the person with a reason

#### Scenario: Fatal
- **WHEN** the slice has a `FATAL` or `PANIC` entry other than the startup entry of a database reset
- **THEN** the verdict is `REVIEW REJECTED`

#### Scenario: Database reset with a good migration
- **WHEN** a run exited 0 and the slice holds the log of a `supabase db reset`, with `FATAL:  role "postgres" does not exist` and no other `FATAL` or `ERROR`
- **THEN** the report lists the entry as an expected startup entry and the verdict can be `REVIEW PASSED`

#### Scenario: Database reset with a broken migration
- **WHEN** the slice holds the log of a `supabase db reset` whose migration has a syntax error
- **THEN** the verdict is `REVIEW REJECTED` on the `ERROR` of the migration, and the startup entry is not a finding

### Requirement: A pgTAP run is recorded with its assertions
For the `supabase` stack a recorded run SHALL carry the file or files passed to `supabase test db` (or none for the whole suite), the number of assertions that ran, the names of the assertions that failed and the exit code. The number of assertions SHALL be read from the summary line `Files=F, Tests=N` (a passing run prints no `ok N` lines) and the failing names from `# Failed test N: "name"` lines, or from `not ok` lines when the output has them. A run whose output has no assertion (`Tests=0`, `skipped` or `No tests run!`), or whose plan was not completed (`Bad plan`, `Looks like you planned`), SHALL count as a run that ran no test. A run told by the person (`ran <exit code>`) SHALL be recorded as the person's, without assertions, and the pull request SHALL say which runs were the person's and which the agent's.

#### Scenario: Passing run
- **WHEN** the output ends with `All tests successful.`, `Files=1, Tests=4` and `Result: PASS`
- **THEN** the run is recorded with exit 0 and 4 assertions

#### Scenario: Failing assertion
- **WHEN** the output has `# Failed test 1: "orders is gone"` and `Failed 1/4 subtests`
- **THEN** the run is recorded with exit non-zero, 4 assertions and that name as failing

#### Scenario: Plan not completed
- **WHEN** the output says `# Looks like you planned 3 tests but ran 2`
- **THEN** the run is recorded as failed, whatever the exit code

#### Scenario: File that ran no assertion
- **WHEN** the output has `No tests run!` or `Files=1, Tests=0`
- **THEN** the run is recorded as a run that ran no test

#### Scenario: Run told by the person
- **WHEN** the person says `ran 0`
- **THEN** the run is recorded as the person's, and the pull request says that no assertions were counted

### Requirement: The checklist includes the advisory notes of the build
The checklist of `review` SHALL include the advisory notes that the build left in the hand-off, each marked as pending after the retries and naming the lens that produced it, in addition to the lines of the scenarios.

#### Scenario: Notes from the interface lens
- **WHEN** the hand-off carries a note from the interface lens
- **THEN** the checklist has a line for it, marked as pending after the retries and naming the lens

#### Scenario: A hand-off without notes
- **WHEN** the hand-off has no notes
- **THEN** the checklist is as it was

### Requirement: A declared adapter asks for the person's word before the agent runs anything
Before the agent runs any command of a review with a declared adapter, `review` SHALL ask the person to confirm in writing that the data the tests touch is not production, and SHALL record it first. A test the person runs themselves with `review.autopilot` `off` SHALL be the person's, with no confirmation asked. The review SHALL never read `.env` files for a declared adapter.

#### Scenario: Confirmation before the agent runs a test
- **WHEN** `review.autopilot` is `precheck` and the adapter is declared
- **THEN** the review asks for the written confirmation before it runs the first test and runs none without it

#### Scenario: Confirmation refused
- **WHEN** the person does not confirm
- **THEN** the agent runs no test and leaves every line to the person

#### Scenario: The person runs the test
- **WHEN** `review.autopilot` is `off` and the adapter is declared
- **THEN** the person runs `review.test` in their own terminal, tells the review `ran <exit code>` and confirms each line, and no confirmation about the data is asked

#### Scenario: Environment files
- **WHEN** the adapter is declared and a test needs a variable that an environment file holds
- **THEN** the review does not read the file and leaves the test to the person

### Requirement: A declared adapter proves a single line only through the filter of its test command
`review.test` of a declared adapter MAY contain `{filter}`. With `review.autopilot` `precheck` or `verify`, the agent SHALL prove a line only by running the command with `{filter}` replaced by one name of a test that already covers it, recording the filter and the number of tests that ran. Without the placeholder it SHALL prove no line and run the whole suite once at the end. It SHALL never write a test. A run proves a line only when it exited 0 and at least one test ran.

#### Scenario: Command with a filter
- **WHEN** `review.test` is `npm test -- {filter}`, a line is covered by the test `login`, and the run exits 0 and reports one test
- **THEN** the agent runs `npm test -- login`, records the run and may mark the line

#### Scenario: Command without a filter
- **WHEN** `review.test` is `npm test` and `review.autopilot` is `verify`
- **THEN** the agent marks no line by itself, runs the whole suite once at the end and records it

#### Scenario: A filter that is not a single name
- **WHEN** the only name the agent has for a test contains a space or a shell character
- **THEN** the agent does not run the command and leaves the line to the person with a note

#### Scenario: A run that reports no count
- **WHEN** the command exits 0 and its output does not say how many tests ran
- **THEN** the proof is refused and the line stays for the person

### Requirement: A declared adapter needs its tools, checked without installing or starting anything
For a declared adapter the preflight SHALL check that each tool in `needs` can be found and, when `docker` is listed, that the Docker daemon answers. It SHALL NOT install or start anything and SHALL NOT read the content of an environment file. A missing tool or a stopped daemon SHALL stop the review before it changes anything and show what the person can do. The review SHALL ask the person to say that the local instance the tests need is up, and SHALL never start or stop it. The preflight SHALL also check the checkout by the existence of paths only: when `npm` is in `needs` and the folder has a `package.json`, that `node_modules` exists, and when the folder has a `.env.example` or `.env.sample`, that `.env` exists. A missing path SHALL NOT stop the review: the preflight SHALL name it and the review SHALL ask the person to confirm before any test or server runs.

#### Scenario: Missing tool
- **WHEN** `needs` lists `nhost` and the tool cannot be found
- **THEN** the preflight names `nhost`, the review stops before changing anything and no installer runs

#### Scenario: Daemon stopped
- **WHEN** `needs` lists `docker` and the daemon does not answer
- **THEN** the preflight says the daemon does not answer and the review stops before changing anything

#### Scenario: Everything present
- **WHEN** every tool in `needs` is found, the daemon answers and the checkout has what it needs
- **THEN** the preflight reports it ready and starts nothing

#### Scenario: Instance not up
- **WHEN** the person says the local instance is not up
- **THEN** the agent runs no test, asks the person to start it and does not start it

#### Scenario: Checkout without dependencies
- **WHEN** `needs` lists `npm`, the folder has a `package.json` and no `node_modules`
- **THEN** the preflight names `node_modules`, gives the install command for the person to run, installs nothing, and the review asks before running any test

#### Scenario: Checkout without environment file
- **WHEN** the folder has a `.env.example` and no `.env`
- **THEN** the preflight names `.env`, never opens either file, and the review asks before running any test

#### Scenario: No example file
- **WHEN** the folder has no `.env.example` and no `.env.sample` and no `.env`
- **THEN** the preflight does not mention an environment file

### Requirement: The audit of a declared adapter flags only the signals that every backend log shares
For a declared adapter the audit SHALL flag, in what the log wrote since the review started, only signals that belong to no framework: `FATAL` or `PANIC`, a deadlock, out of memory, a database `ERROR` that is not a denial or a constraint violation, and an HTTP status of 500 or above. Denials and constraint violations SHALL be listed as expected while a run is recorded. The report SHALL say that errors without those signals are not detected.

#### Scenario: Fatal entry
- **WHEN** a run exited 0 and the slice holds a `FATAL` entry
- **THEN** the verdict is `REVIEW REJECTED` and the person can waive the finding with a reason

#### Scenario: Expected denial
- **WHEN** a run exited 0 and the slice holds `permission denied for table` and nothing else
- **THEN** the report lists it as an expected denial and the verdict can be `REVIEW PASSED`

#### Scenario: Server error
- **WHEN** the slice holds a response with status 500
- **THEN** the verdict is `REVIEW REJECTED`

#### Scenario: Quiet log with a run
- **WHEN** a run exited 0 and the slice is empty
- **THEN** the verdict is `REVIEW PASSED` and the report says that the recorded run is the proof

#### Scenario: Not detected
- **WHEN** a run exited 0 and the slice holds an application error that carries none of those signals
- **THEN** the verdict can be `REVIEW PASSED` and the report says that errors without those signals are not detected

### Requirement: An iOS review chooses its simulator
An iOS review SHALL use the one iOS Simulator that is booted, or the one named in the environment variable `IOS_SIMULATOR` (a UDID or a name), and SHALL read the list with `xcrun simctl list devices booted --json`. When none is booted, or several are and none is named, or the named one is not booted, the review SHALL stop before changing anything with a message the person can act on, and SHALL NOT boot a simulator itself.

#### Scenario: One simulator is booted
- **WHEN** exactly one simulator is booted
- **THEN** the review uses it and records its UDID

#### Scenario: None is booted
- **WHEN** no simulator is booted
- **THEN** the review stops, says that none is booted and that the person boots one (the Simulator app, or `xcrun simctl boot <udid>`), and changes nothing

#### Scenario: Several are booted
- **WHEN** two simulators are booted and `IOS_SIMULATOR` is not set
- **THEN** the review stops, names both and says to set `IOS_SIMULATOR` to the one to use

#### Scenario: The named simulator is not booted
- **WHEN** `IOS_SIMULATOR` names a simulator that is not booted
- **THEN** the review stops and says that it is not booted

### Requirement: An iOS review takes captures from the simulator
An iOS review SHALL take a capture with `xcrun simctl io <udid> screenshot <file>` and save it as `evidence/<name>.png`, SHALL accept only plain file names under the same rule as an Android capture, and SHALL NOT open the image. A simulator that returns no image SHALL be reported as such.

#### Scenario: A capture is requested
- **WHEN** the person asks for a capture named `02_after_tap`
- **THEN** `evidence/02_after_tap.png` is written from the simulator and the agent does not open it

#### Scenario: A bad name
- **WHEN** the name contains a slash or `..`
- **THEN** the capture is refused before `simctl` runs

#### Scenario: The simulator returns nothing
- **WHEN** `simctl` exits with an error or writes an empty file
- **THEN** the review says that no image was produced and what the error was, and records no evidence

### Requirement: The audit of an iOS review separates faults and the app's errors from system noise
For an iOS review the audit SHALL read only the log of the app under review since the review started, as `simctl spawn <udid> log show --style ndjson --start <time> --predicate 'process == "<app>"'`, and SHALL ignore a line that is not a log entry. Every entry of type `Fault` SHALL be a finding, including the runtime issues that SwiftUI reports. An entry of type `Error` SHALL be counted and reported as system noise when its subsystem begins with `com.apple.`, and SHALL be a finding otherwise (the app itself, an empty subsystem, or a library that is not Apple's). Entries of other types SHALL NOT be findings. Identical findings SHALL be reported once with a count. A log with no entry from the app SHALL be inconclusive, as for the other adapters. A crash report of the app captured after the review started (a `.ips` file under `~/Library/Logs/DiagnosticReports/` named after the executable, whose `captureTime` is after the start time and whose path holds the UDID of the simulator) SHALL be a finding of class `crash`, even when the log is empty, because the log of an app that crashed does not show the crash.

#### Scenario: A SwiftUI runtime issue
- **WHEN** the log holds a `Fault` from the subsystem `com.apple.runtime-issues`
- **THEN** it is a finding

#### Scenario: An error of the app or of a library
- **WHEN** the log holds an `Error` whose subsystem is the bundle identifier of the app, is empty, or belongs to a library that is not Apple's
- **THEN** it is a finding

#### Scenario: The same finding twice
- **WHEN** the same `Fault` appears three times
- **THEN** the audit reports it once with a count of 3

#### Scenario: Noise of an Apple framework
- **WHEN** the log holds an `Error` from `com.apple.app_launch_measurement`
- **THEN** it is not a finding, and the audit reports how many system errors it ignored

#### Scenario: Entries from before the review
- **WHEN** an `Error` of the app was written before the start time
- **THEN** it is not read

#### Scenario: A crash of the app
- **WHEN** the app crashed after the review started and its crash report is in the folder of reports
- **THEN** the audit is `REVIEW REJECTED` with a `crash` finding, even if the log of the app is empty

#### Scenario: A crash from before the review or of another app
- **WHEN** a crash report was captured before the start time, or belongs to another executable or another simulator
- **THEN** it is not read as a finding

#### Scenario: An empty log
- **WHEN** the filter matches no entry
- **THEN** the audit is inconclusive and says so

#### Scenario: Lines that are not entries
- **WHEN** the output has a line that is not JSON
- **THEN** the audit skips it and still reads the rest

### Requirement: The autopilot has no iOS driver yet
With `review.autopilot` `precheck` or `verify` on an iOS platform, `review` SHALL say that the agent cannot drive an iOS app yet and SHALL proceed as with `off`: the person drives and confirms every line. The agent SHALL NOT tap, swipe, type or press keys in the simulator, and SHALL NOT use coordinates, Appium, Maestro or a UI-automation tool.

#### Scenario: Autopilot on an iOS platform
- **WHEN** `review.autopilot` is `verify` and the platform has the target `ios`
- **THEN** `review` says that there is no iOS driver yet, the review proceeds as with `off`, and the agent operates nothing in the simulator

### Requirement: The audit of a declared adapter treats the errors a repository lists as expected
For a declared adapter the audit SHALL treat a Postgres `ERROR:` line whose message (the text after the first `ERROR:`) contains an entry of `review.expected_errors` as an expected error: listed in the report with the entry that matched and its count, and not a finding, while a run is recorded. With no run recorded it SHALL be a finding of the class `denial`. The list SHALL come from the state recorded at `init` and SHALL be read only for a declared adapter.

#### Scenario: Provoked errors with a listed code
- **WHEN** a run exited 0, the list holds `bitacora_inmutable` and the slice holds three `ERROR:  bitacora_inmutable: no se puede modificar` lines and nothing else
- **THEN** the verdict is `REVIEW PASSED` and the report lists the pattern with 3 matches, not as findings

#### Scenario: No run recorded
- **WHEN** no run is recorded and the slice holds a listed error
- **THEN** it is a `denial` finding

#### Scenario: Not a declared adapter
- **WHEN** the review is of `supabase` or `laravel` and `init` is given `--expected-error`
- **THEN** `init` fails and says that the list goes with a declared adapter

#### Scenario: Empty list
- **WHEN** the list is empty or absent
- **THEN** the audit classifies as before

### Requirement: An expected error never excuses a fatal signal and a waiver stays the person's
A line that carries a `FATAL` or `PANIC` level, a deadlock, an out-of-memory message or an HTTP status of 500 or above SHALL stay a finding whatever `review.expected_errors` says. The only exception is a `FATAL:` line whose whole message is an entry of `review.expected_fatals`, and it never reaches a `PANIC` line, a deadlock, an out-of-memory message or an HTTP status of 500 or above. An `ERROR:` line that matches no entry and no denial SHALL stay a `database-error` finding. The report SHALL say that the patterns are the repository's declaration. The agent SHALL NOT add a pattern to a profile or waive a finding: waiving stays the person's decision.

#### Scenario: Unlisted error
- **WHEN** the list holds `bitacora_inmutable` and the slice also holds `ERROR:  relation "x" does not exist`
- **THEN** the verdict is `REVIEW REJECTED` with one `database-error` finding

#### Scenario: Fatal entry with a listed word
- **WHEN** the slice holds `FATAL:  bitacora_inmutable` and `review.expected_errors` holds `bitacora_inmutable`
- **THEN** the verdict is `REVIEW REJECTED` with a `fatal` finding

#### Scenario: Deadlock or out of memory
- **WHEN** the slice holds `ERROR:  deadlock detected` or `ERROR:  out of memory`
- **THEN** the verdict is `REVIEW REJECTED` whatever either list holds

#### Scenario: Fatal signal on a listed message
- **WHEN** a `FATAL:` line has a message equal to an entry of `review.expected_fatals` and the same line carries `out of memory` or a response with status 500
- **THEN** it stays a finding

#### Scenario: Panic
- **WHEN** the slice holds `PANIC:  could not write to file`
- **THEN** the verdict is `REVIEW REJECTED` whatever either list holds

#### Scenario: Server error
- **WHEN** the slice holds a response with status 500
- **THEN** the verdict is `REVIEW REJECTED` whatever either list holds

### Requirement: A held branch says whether its worktree can be removed
When another worktree holds the branch of the issue, `review` SHALL say whether that worktree can be removed. It can be removed when its tree is clean (no change and no untracked file) and every commit of its branch is on the remote branch. `review` SHALL name what prevents the removal when it cannot be done. When it can, `review` SHALL give the command, ask the person, and only on a yes remove the worktree with `git worktree remove` without `--force` and go on from the start of the step. `review` SHALL NOT remove a worktree that the person has not agreed to remove, the main working tree, or the working tree it runs in.

#### Scenario: A finished worktree that holds nothing that is not on the remote
- **WHEN** the worktree that holds the branch is clean and its `HEAD` is on `origin/<branch>`
- **THEN** `review` says it holds nothing that is not on the remote, gives `git worktree remove "<path>"` and asks before it removes it, leaving the issue `built` until then

#### Scenario: The person agrees
- **WHEN** the person answers yes
- **THEN** `review` removes the worktree without `--force` and goes on to switch to the branch

#### Scenario: The worktree has something of its own
- **WHEN** the worktree has an uncommitted change, an untracked file or a commit that is not on the remote
- **THEN** `review` names it, removes nothing, changes no file, label or comment, and says the person can review there or save that work first

#### Scenario: The branch holds only the specification
- **WHEN** the branch differs from the base branch only inside the change folder
- **THEN** `review` says there is nothing to review in it and that the way out is to delete the remote branch and build the issue again

#### Scenario: The output the skill already read
- **WHEN** the check runs
- **THEN** it still exits 1 and prints the path of the holder on its own line, and exits 0 when the branch is free or held only by the working tree it runs in

### Requirement: The Compose project in use is compared with the checkout under review
For a declared adapter with a `compose:` log, `init` and the preflight SHALL read, without changing anything, the working directory that Docker Compose recorded for the running project, and SHALL warn when it is not the folder of the platform being reviewed, naming both folders and the branch of each when it is known. A warning SHALL NOT stop the review. When the running project cannot be found or the working directory is not recorded, the review SHALL say so and go on.

#### Scenario: Instance from another worktree
- **WHEN** the Compose project is running from the folder of another worktree
- **THEN** the review names that folder and the folder under review and warns that the tests exercise the code the instance runs, which may be another branch

#### Scenario: Same folder
- **WHEN** the recorded working directory is the folder of the platform
- **THEN** the review says nothing about it

#### Scenario: Not running
- **WHEN** no Compose project is running
- **THEN** the review says that no running project was found and does not warn about a folder

### Requirement: The state of a review belongs to one change
The state of a review SHALL record the name of the change and the kind of review (`device`, `api` or iOS) it was created for. `init` SHALL refuse to overwrite a state that belongs to another change or kind, and say which. `review-state.mjs owner <change-dir>` SHALL exit 0 when the state is for that change and that kind, and exit 1 naming what differs when it is not. A state that records no change SHALL be reported as one whose owner is unknown, and the review SHALL ask the person whether it is theirs before resuming it.

#### Scenario: State of another issue
- **WHEN** `evidence/review-state.json` was created for `add-login` and the review of `rename-orders` starts
- **THEN** `init` refuses, names both changes, and leaves the file as it is

#### Scenario: State of another kind
- **WHEN** the file holds an `api` state and the review is a device review of the same change
- **THEN** `owner` exits 1 and says the state is for an `api` review

#### Scenario: Same change
- **WHEN** the state was created for the change being resumed
- **THEN** `owner` exits 0 and the review resumes

#### Scenario: Older state
- **WHEN** the state records no change
- **THEN** `owner` says the owner is unknown and the review asks the person before resuming it

### Requirement: The audit of a declared adapter treats the fatal messages a repository lists as expected
For a declared adapter the audit SHALL treat a `FATAL:` line whose message (the text after the first `FATAL:`, with whitespace collapsed) is equal to an entry of `review.expected_fatals` as an expected fatal: listed in the report with the entry that matched and its count, and not a finding, while a run is recorded. With no run recorded it SHALL be a finding of the class `fatal`. A message that only contains an entry, or that an entry only contains, SHALL NOT match. The list SHALL come from the state recorded at `init` and SHALL be read only for a declared adapter. The report SHALL say that these entries are the repository's declaration of what its own test harness provokes, and that a waiver stays the person's decision.

#### Scenario: Autovacuum ended by the harness
- **WHEN** a run exited 0, the list holds `terminating autovacuum process due to administrator command` and the slice holds three `FATAL:  terminating autovacuum process due to administrator command` lines and a `LOG:  checkpoint starting: immediate force wait`
- **THEN** the verdict is `REVIEW PASSED` and the report lists the entry with 3 matches, not as findings

#### Scenario: No run recorded
- **WHEN** no run is recorded and the slice holds a listed fatal
- **THEN** it is a `fatal` finding

#### Scenario: A longer or shorter message
- **WHEN** the list holds `terminating autovacuum process due to administrator command` and the slice holds `FATAL:  terminating connection due to administrator command` or `FATAL:  terminating autovacuum process due to administrator command, then more`
- **THEN** each is a `fatal` finding and the verdict is `REVIEW REJECTED`

#### Scenario: Unlisted fatal
- **WHEN** the list holds one entry and the slice also holds `FATAL:  the database system is shutting down`
- **THEN** the verdict is `REVIEW REJECTED` with one `fatal` finding

#### Scenario: Not a declared adapter
- **WHEN** the review is of `supabase` or `laravel` and `init` is given `--expected-fatal`
- **THEN** `init` fails and says that the list goes with a declared adapter

#### Scenario: Empty list
- **WHEN** the list is empty or absent
- **THEN** the audit classifies as before
