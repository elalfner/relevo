# Design

## Context

The `device` adapter is Android only: `scripts/lib/device.mjs` runs `adb`, `scripts/capture.mjs` takes `adb exec-out screencap`, the audit reads `adb logcat -v threadtime` in `scripts/lib/logaudit.mjs`, and `skills/review/SKILL.md` hardcodes those commands. `scripts/lib/review-adapters.mjs` answers iOS with `NOT_AVAILABLE`. See proposal.md for why.

What was checked on a Mac with Xcode 27.2 on 2026-11-17 (a throwaway simulator created on the one runtime installed, iOS 27.1; the only device type that accepted that runtime was `iPhone Duo`):

- `simctl list devices booted --json` exits 0 with an empty `devices` map when none is booted, and lists `{ udid, name, state: "Booted" }` under the runtime when one is.
- With nothing booted, `simctl io booted screenshot` and `simctl spawn booted log show` both exit 148 and print `No devices are booted.`.
- `simctl spawn <udid> log show --style ndjson --predicate 'process == "<app>"'` writes one JSON object per line. The fields the audit uses are present: `messageType` (`Default`, `Error`, `Fault`, or absent on some entries), `subsystem`, `category`, `eventMessage`, `processID`, `processImagePath`, `timestamp` (with a UTC offset, for example `2026-11-17 09:17:36.688170-0600`). A 2-minute slice of a freshly launched app held 273 entries: 261 `Default`, 3 `Error` and 9 with no type.
- The three `Error` entries came from Apple frameworks inside the app's own process (for example the subsystem `com.apple.app_launch_measurement`, "Failed to send CA Event for app launch measurements"). They are the reason the audit separates system noise from the app's errors.
- `--start "YYYY-MM-DD HH:MM:SS"` works and is read in the **host's local time**. `log show` exits 0 when nothing matches. Some output lines are not JSON (a `getpwuid_r` notice appeared), so the parser has to skip them.

What could not be checked on that machine, and was checked on 2026-11-19 on a Mac whose simulator works (iOS 27.0, Xcode 27.2; results in `docs/pilot-findings.md`):

- `simctl io <udid> screenshot <file>` failed with `Invalid argument` on the only device type available, with or without `--type`, and `-` (stdout) wrote 0 bytes. `Simulator.app` could not be opened by name either, so the cause could be the device type or the install, and the working form of the command is not confirmed.
- How a crash of the app shows up: it is not in the process's log, and the crash report is a file under `~/Library/Logs/DiagnosticReports/`. Verified: the report is a `.ips` file named `<executable>-<YYYY-MM-DD-HHMMSS>.ips`, with a `captureTime` in its body.
- A runtime issue reported by SwiftUI (for example "Publishing changes from within view updates") as a `Fault` with the subsystem `com.apple.runtime-issues`: seen on a real run (state changed inside `body`).

## Goals / Non-Goals

**Goals:**
- Let `/relevo:review` run for an iOS platform the way it runs for Android: the person drives in a simulator, the agent captures on request and audits the log at the end.
- Keep every change to existing code additive, so no existing adapter changes behaviour.

**Non-Goals:**
- A physical iPhone. A device needs a tool Relevo does not have (`idevicesyslog` or Console access) and a signed build.
- An iOS driver for `precheck` and `verify` (XCUITest or an accessibility-based tool). It needs its own design, and the review keeps its rule against coordinates, Appium and Maestro.
- Booting or installing anything in the simulator: the person has the app running.
- Shipping the SwiftUI profile in `stacks/`. A project can define the stack `swiftui` in `.relevo/stacks/swiftui.md`; the adapter is keyed on the stack name, whoever ships the profile.

## Decisions

**1. The device is a simulator, observe-only first.** Android's review is observe-only by default and the autopilot adds a driver. iOS gets the observe-only half now. The autopilot flag on an iOS platform does not fail: the review says there is no driver and proceeds as `off`. Alternative: refuse the review when the autopilot is not `off`. Rejected: it would block a team that set `verify` for its Vue platform in the same repository.

**2. Keys `flutter/ios` and `swiftui/ios`, kind `device`.** The table is keyed by stack and target, and the target is what differs from Android, so the two stacks that can have an iOS target share one entry shape. A custom stack under another name needs its own key; adding a way to declare an adapter in a profile is a separate change.

**3. Simulator choice mirrors Android.** `pickSimulator(list, preferred)` returns the only booted one or the one in `IOS_SIMULATOR` (a UDID or a name), and throws a message a person can act on, as `pickDevice` does with `ANDROID_SERIAL`. The review never boots a simulator.

**4. Capture goes to a file, through an injectable runner.** `simctl io screenshot` is called with the destination path, not through stdout, because stdout did not work here. The directory is created first and the name goes through the existing `safeCaptureName`. The runner is injected so the logic is tested without a simulator, as `adb` is.

**5. The audit reads ndjson, not text.** `log show --style ndjson` gives typed entries, so the audit does not need regular expressions over a text format. The filter is `process == "<app>"` where `<app>` is the process name (the executable), found from the bundle's `Info.plist` (`CFBundleExecutable`). Entries before the start time are excluded by `--start`, in host local time.

**6. What is a finding.** `Fault`: always. `Error` from `com.apple.*`: system noise, counted and shown, not a finding. Any other `Error` (the app's own subsystem, an empty one, or a library that is not Apple's): a finding. Other types: not findings. Alternatives: treat every `Error` as a finding, or only those of the app's own subsystem. The first was rejected because a freshly launched app already has several from Apple frameworks, so every review would start red and the person would learn to ignore the audit. The second was rejected because a third-party SDK that fails (a payments or analytics library) is exactly what a review should catch, and it logs under its own subsystem. The cost is that a noisy third-party library needs an ignore list later; none is built now.

**7. Nothing is marked supported before it works.** The adapter entry is the last thing added. Until the audit and the skill can handle iOS, `review-adapters.mjs` keeps answering "not available yet", so `review` never reaches an `adb` command for an iOS platform.

## Risks / Trade-offs

- The screenshot command was not confirmed on a simulator (see above). The fallback is `simctl io <udid> recordVideo` or the Simulator app's own screenshot, neither verified; task 1.1 decides.
- Crashes are not in the process log. An app that crashed mid-review leaves a quiet log (a `fatalError` leaves one `Default` line, not a `Fault`), so the audit also lists the crash reports newer than the review start.
- The host's local time is used for `--start`. A review that crosses a change of the clock could read a wrong window; the risk is accepted as the Supabase adapter accepts the same kind of timestamp rule.
- Apple changes `log show` output and the runtime-issue subsystem between releases. The audit relies on `messageType` and `subsystem`, which are the stable parts; the tests carry a fixture captured from a run.
- The iOS review runs only on macOS. The cloud workflow uses `ubuntu-latest` unless `runner.labels` names a Mac, and `review` is a local step anyway.

## Open Questions

None that change what gets built first. Whether to also ship `stacks/swiftui.md` and how a custom stack declares its adapter are follow-ups.
