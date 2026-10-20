## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: The person drives, the agent observes
By default the agent SHALL NOT tap, type, swipe or otherwise automate the app or the device, and SHALL NOT use UI automation or monkey tools; it only observes. Only when `review.autopilot` is `precheck` or `verify` may it drive the app, within the limits of the requirement on operating the app. Actions in third-party apps that send messages SHALL be performed only by a person.

#### Scenario: Forbidden automation
- **WHEN** the agent is about to issue an input command to the device and `review.autopilot` is `off`
- **THEN** it does not, and asks the person to do it

#### Scenario: Autopilot on
- **WHEN** `review.autopilot` is `precheck`
- **THEN** the agent may drive the app only through semantic finders or the runner's own browser
