# Spec Delta

## MODIFIED Requirements

### Requirement: The review picks its adapter from the platform and the target
`review` SHALL resolve, from the platform of the issue and its target, how the review obtains its log and captures and whether it can be driven: a device with `adb` for Flutter on `android`, a simulator with `xcrun` for Flutter on `ios` (macOS only), a browser for `web`. A combination without an adapter SHALL stop the review before it changes anything, naming what is missing. When the adapter is a browser and `review.autopilot` is `off`, the stop message SHALL recommend `verify`, with `precheck` as the cautious option, in the language of `relevo.yml`.

#### Scenario: Android device
- **WHEN** the platform is Flutter with the target `android`
- **THEN** the adapter is the device with `adb`, and the review proceeds as before

#### Scenario: Web
- **WHEN** the platform is Vue with the target `web`
- **THEN** the adapter is the browser, and the review needs `review.autopilot` other than `off`

#### Scenario: Web with autopilot off
- **WHEN** the platform is Vue with the target `web` and `review.autopilot` is `off`
- **THEN** the review stops before changing anything, recommends `verify` and names `precheck` as the cautious option, and says that the person still confirms every line and that lines about appearance are never marked automatically

#### Scenario: No adapter
- **WHEN** the combination has no adapter, or the tool it needs is missing
- **THEN** `review` stops before changing anything and says what to install or that it is not supported yet

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

## ADDED Requirements

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
Before the first run, a browser review SHALL check that the project's dependencies are installed, that the browser library and its browser resolve from the project, and that the address under review and the module scripts its page loads from the same origin answer with a status below 400. The browser library SHALL be installed only with the person's permission and without saving it to the project's manifest; a lock file changed by that install SHALL be restored.

#### Scenario: Dependencies missing
- **WHEN** the project has no installed dependencies
- **THEN** the review says to install them first and does not drive

#### Scenario: Browser library missing
- **WHEN** the browser library does not resolve from the project
- **THEN** the review asks the person for permission before installing it, installs it without saving it to the manifest, and restores the lock file if it changed

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
