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
`review` SHALL resolve, from the platform of the issue and its target, how the review obtains its log and captures and whether it can be driven: a device with `adb` for Flutter on `android`, a simulator with `xcrun` for Flutter on `ios` (macOS only), a browser for `web`, and the `api` adapter for a stack with no targets that has one (Laravel). A combination without an adapter SHALL stop the review before it changes anything, naming what is missing, which adapters exist and what the person can do next. When the adapter is a browser and `review.autopilot` is `off`, the stop message SHALL recommend `verify`, with `precheck` as the cautious option, in the language of `relevo.yml`.

#### Scenario: Android device
- **WHEN** the platform is Flutter with the target `android`
- **THEN** the adapter is the device with `adb`, and the review proceeds as before

#### Scenario: Web
- **WHEN** the platform is Vue with the target `web`
- **THEN** the adapter is the browser, and the review needs `review.autopilot` other than `off`

#### Scenario: Web with autopilot off
- **WHEN** the platform is Vue with the target `web` and `review.autopilot` is `off`
- **THEN** the review stops before changing anything, recommends `verify` and names `precheck` as the cautious option, and says that the person still confirms every line and that lines about appearance are never marked automatically

#### Scenario: Laravel
- **WHEN** the platform has the stack `laravel`, which defines no targets
- **THEN** the adapter is `api`, and the review does not need `review.autopilot` other than `off`

#### Scenario: No adapter
- **WHEN** the combination has no adapter, or the tool it needs is missing
- **THEN** `review` stops before changing anything, says what to install or that it is not supported yet, names the adapters that exist, says that the issue stays `built`, and says that a stack the plugin ships can tune its review in its profile

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
With `review.autopilot` `precheck` or `verify`, the agent SHALL prove a line of an `api` review only by running the feature test that already covers its scenario, never by writing or editing a test, and SHALL record the filter it used, the number of tests that ran and the exit code. A run that matched no test SHALL be a failed proof. With `verify` a line SHALL be marked `ok (auto)` only when the exit code proves its `THEN`; a line with no covering test, or one whose test does not assert its `THEN`, SHALL stay for the person.

#### Scenario: A test covers the line
- **WHEN** `review.autopilot` is `verify` and the test for line 2 ran once and exited 0
- **THEN** line 2 is `ok (auto)` and the pull request lists it with the test name

#### Scenario: Precheck
- **WHEN** `review.autopilot` is `precheck` and the test for line 2 exited 0
- **THEN** line 2 is recorded as pre-checked and stays pending until the person confirms it

#### Scenario: A filter that matches nothing
- **WHEN** the filter matched no test
- **THEN** the proof fails, the line stays pending and the agent says no test was found

#### Scenario: No test for the line
- **WHEN** no test of the project covers a line
- **THEN** the agent does not write one, and the line is left to the person with a note that it has no test

### Requirement: The audit of an api review reads the log since the review started
For the `api` adapter the audit SHALL read only what the project's log files received since the review started, recorded as an offset per file when the state is created, SHALL treat a file that appears later as new from its start, and SHALL NOT truncate or delete a log. It SHALL report a file it could not read.

#### Scenario: Entries from before the review
- **WHEN** the log already had an unhandled exception before the review started and none after
- **THEN** the exception is not a finding

#### Scenario: Daily log
- **WHEN** the project writes `laravel-<date>.log` and a new file appears after the review started
- **THEN** the audit reads the new file from its start

#### Scenario: Unreadable file
- **WHEN** a log file named by the setting cannot be read
- **THEN** the report says which file and why, and the verdict is not `REVIEW PASSED` on that file's account

### Requirement: A recorded test run proves an api review whose log is quiet
For the `api` adapter, an empty log slice SHALL be `REVIEW INCONCLUSIVE` only when no test run is recorded in the review state, and SHALL be `REVIEW PASSED` when a run is recorded and the latest run of each line or filter exited 0, so a run repeated after a fix replaces the one before. A latest run with a non-zero exit code SHALL be `REVIEW REJECTED` and name the failing tests. The log slice SHALL still be scanned for unhandled exceptions, server errors and database errors. A run told by the person SHALL be recorded as the person's, and the pull request SHALL say which runs were the person's and which the agent's.

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

### Requirement: An api review checks its tools and the test database before running
Before an `api` review runs a test, the review SHALL check that PHP and Composer can be found, that the installed dependencies match the lock file, and which database the test configuration declares, without reading the real environment files. A database other than in-memory SQLite, or one the test configuration does not declare, SHALL need the person's written confirmation that it is not production before any test or server runs. The review SHALL install nothing; for missing dependencies it SHALL give the command for the person to run.

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
