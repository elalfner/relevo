# Tasks

## 1. Check what the design leaves unverified

- [x] 1.1 On a Mac whose simulator works, boot an iPhone, install and launch an app, and find the form of `xcrun simctl io <udid> screenshot` that writes a PNG (with and without `--type`, to a file and to `-`); on 2026-11-17 it failed with `Invalid argument` on the only device type available. Record the working form in `docs/pilot-findings.md` and fix `captureIos` if it differs.
- [x] 1.2 Crash the app on purpose and note where the evidence is (the process log does not hold it; look at `~/Library/Logs/DiagnosticReports/` and the simulator's own folder), how the file is named, and whether its time can be compared with the review start; keep a sanitized fixture.
- [x] 1.3 Make SwiftUI report a runtime issue on purpose (for example, change state inside `body`) and keep the `log show --style ndjson` entry as a fixture to confirm that it is a `Fault` under `com.apple.runtime-issues`; if the type or subsystem differs, change `auditIosLog` and the scenario.
- [x] 1.4 Confirm how to get the process name of the app from the installed bundle (`CFBundleExecutable` in its `Info.plist`, found with `xcrun simctl get_app_container <udid> <bundle-id> app`) and that `process == "<name>"` matches the app and nothing else.

## 2. Simulator detection and capture

- [x] 2.1 Add `scripts/lib/device-ios.mjs`: parse `simctl list devices booted --json`, pick the only booted simulator or the one in `IOS_SIMULATOR` (UDID or name) with messages a person can act on, capture into `evidence/<name>.png` with an injectable runner, and build the arguments of the log read; verify with `tests/device-ios.test.mjs` for each scenario of "An iOS review chooses its simulator" and "An iOS review takes captures from the simulator".
- [x] 2.2 Add `--target ios` to `scripts/device.mjs` and `scripts/capture.mjs`, with the same exit codes, and the message for a missing `xcrun`; verify with the scripts run against a fake `xcrun` in `tests/device-ios.test.mjs`.

## 3. The audit

- [x] 3.1 Add `scripts/lib/logaudit-ios.mjs`: read ndjson skipping what is not an entry, report `Fault` and non-Apple `Error` as findings folded by message, count Apple `Error` as system noise, and call an empty log inconclusive; verify with `tests/logaudit-ios.test.mjs` and the sanitized fixture of a real launch in `tests/fixtures/ios-log/`.
- [x] 3.2 In `scripts/lib/review-state.mjs` and `scripts/review-state.mjs`, record the simulator source at `init` (`{ source: 'simulator', udid, process, since }`, with `since` in local time), take a new start on `reset-log`, add an `audit` input that reads the simulator log through `readIosLog` and `auditIosLog`, and keep the rule that a recorded passing run does not make an empty log conclusive; verify with tests using a fake runner for a clean slice, a slice with findings, an empty slice and a simulator that is no longer booted.
- [x] 3.3 List the crash reports of the app that are newer than the review start as findings (design of task 1.2); verify with a folder of fixtures (`tests/logaudit-ios.test.mjs`).
- [x] 3.4 Keep `ignored` (the system noise count) in the report the audit prints and in the pull request body, and make the finding waivable like the others; verify with `tests/review-waivers.test.mjs` cases for a finding of an iOS audit.

## 4. The autopilot has no iOS driver

- [x] 4.1 For a platform whose target is `ios` and `review.autopilot` `precheck` or `verify`, make `review-adapter.mjs` print a `notice` that there is no iOS driver yet, make `needsAutopilot` stay false, and make the skill proceed as `off`; verify with tests in `tests/review-adapters.test.mjs` and `tests/review-autopilot.test.mjs`.

## 5. The adapter and the skill (last, so iOS is never marked supported before it works)

- [x] 5.1 Add `flutter/ios` and `swiftui/ios` (kind `device`, log `xcrun simctl log show`, capture `xcrun simctl io screenshot`, driver none, needs `xcrun`) to `scripts/lib/review-adapters.mjs`, remove `NOT_AVAILABLE` for iOS, update `EXISTING` and the stop message, and change the test that expects "iOS is not available yet"; verify with cases for Flutter on iOS, SwiftUI on iOS, an iOS target on Linux and an unknown stack.
- [x] 5.2 Update `skills/review/SKILL.md`: the preflight with `device.mjs --target ios`, the simulator log kept per message and the audit command for iOS, captures with `capture.mjs --target ios`, and the rules (no tap, swipe, type, coordinates, Appium or Maestro in the simulator; never boot one); verify `tests/skill-review.test.mjs` passes and add a test that the skill names `--target ios`, `IOS_SIMULATOR` and the audit input.
- [x] 5.3 Update `stacks/flutter.md` (the `ios` target text: a simulator, observe-only, no driver yet) and `tests/stack-profile.test.mjs` or `tests/stack-profiles-shipped.test.mjs` if they read it.

## 6. Doctor and docs

- [x] 6.1 In `scripts/lib/doctor.mjs`, add the checks of "Doctor checks what an iOS review needs" (macOS, `xcrun`, `simctl`, a runtime, a booted simulator as a note) and the sentence in `skills/doctor/SKILL.md`; verify with tests in `tests/doctor.test.mjs` for each scenario, including a repository with no iOS platform.
- [x] 6.2 Describe the iOS review in `docs/commands.md`, `docs/stacks.md`, `docs/execution.md` and the Spanish pages (what `review` does for an iOS app, that the person drives, that the autopilot has no iOS driver yet, that it needs macOS and a booted simulator, and what a physical iPhone does not get); verify with `tests/docs-claims.test.mjs`.
- [x] 6.3 Add the entry under `## [Unreleased]` in `CHANGELOG.md` (Added: the iOS review; Changed: the stop message) and keep the changelog format.

## 7. Whole change

- [x] 7.1 Run the review by hand on an iOS app in a simulator (the mock `maqueta-ios` of the OMB project is one), calling the scripts in the order the skill gives, and record in `docs/pilot-findings.md` what was caught and what was not tried; if the simulator does not work on the machine, record that this is a follow-up.
- [x] 7.2 Run `npm test` and `openspec validate --all` and verify both pass (the `playwrightFacts` test in `tests/doctor.test.mjs` fails without this change).

## Workflow follow-up

- After the merge, review a real SwiftUI or Flutter iOS issue with `/relevo:review` from `npm pack github:elalfner/relevo#dev` on a Mac, and add to `docs/pilot-findings.md` what the model did with the skill, what was caught and what was not.
- Decide whether to ship `stacks/swiftui.md` in the plugin, and how a stack defined under `.relevo/stacks/` declares its own review adapter.
- An iOS driver for `precheck` and `verify` (XCUITest or an accessibility-based tool) is a change of its own.
- Archive the change after the pull request to `dev` is merged, then run `npm test` and `openspec validate --all` again.
