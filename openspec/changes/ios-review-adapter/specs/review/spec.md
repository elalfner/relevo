# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
