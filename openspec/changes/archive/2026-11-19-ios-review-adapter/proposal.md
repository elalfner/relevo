# Proposal

## Why

A repository with an iOS platform cannot finish an issue. `/relevo:go` builds it, but `/relevo:review` stops in its preflight with "the review of iOS is not available yet", so the issue stays `built` and the pull request is opened by hand. Flutter lists `ios` as a target and a native SwiftUI app can declare its own stack in `.relevo/stacks/`, so both reach this stop. The adapters for Android, web, Laravel and Supabase already exist; iOS is the one platform a team can build with Relevo and not review with it.

## What Changes

- Add a review adapter of the existing kind `device` for the target `ios`, keyed `flutter/ios` and `swiftui/ios`. The device is an **iOS Simulator** driven with `xcrun simctl` (macOS only). A physical iPhone is out of scope.
- The first version is **observe-only**: the person drives the app in the simulator and the agent saves screenshots on request and audits the log when the person says they are done, as it does today for Android. `review.autopilot` `precheck` and `verify` have no iOS driver yet; with either, the review says so and proceeds as `off`.
- Detect the simulator with `simctl list devices booted --json`: the only booted one, or the one named in `IOS_SIMULATOR` (a UDID or a name). Say what to do when none or several are booted.
- Take a screenshot with `simctl io <udid> screenshot <file>` into `evidence/`, never opened, with the same plain-file-name rule as Android.
- Read the log of the app since the review started with `simctl spawn <udid> log show --style ndjson --start <time> --predicate 'process == "<app>"'`, and audit it: a `Fault` is a finding (it includes the runtime issues SwiftUI reports), an `Error` from the app or from a library that is not Apple's is a finding, an `Error` from an Apple framework is counted and listed as system noise, and an empty log is inconclusive.
- `doctor` checks what the iOS review needs (macOS, Xcode command line tools, `simctl`, a simulator runtime).
- Replace "the review of iOS is not available yet" and the list of adapters that exist in the stop message, and describe the iOS review in the docs in both languages and in the changelog.
- Ship the change in steps that never leave iOS marked as supported before the audit and the skill can handle it (see the order in `tasks.md`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the adapter table includes a simulator for `ios`; an iOS review picks its simulator, takes captures from it and audits a simulator log; the autopilot has no iOS driver yet.
- `init-doctor`: `doctor` reports what the iOS review needs.

## Impact

- `scripts/lib/device-ios.mjs` (new), `scripts/device.mjs` and `scripts/capture.mjs`: simulator detection and capture behind a `--target ios` flag.
- `scripts/lib/logaudit-ios.mjs` (new), `scripts/lib/review-state.mjs` and `scripts/review-state.mjs`: the simulator log as a source and its audit.
- `scripts/lib/review-adapters.mjs` and `scripts/review-adapter.mjs`: the `flutter/ios` and `swiftui/ios` entries, the stop message.
- `scripts/lib/doctor.mjs`, `skills/review/SKILL.md` and `skills/doctor/SKILL.md`: the checks and the steps for this adapter. `stacks/flutter.md`: the `ios` target text.
- Tests under `tests/`, the docs in both languages and `CHANGELOG.md`.
- No change to the build, QA, fix or ship, none to the Android, web, Laravel or Supabase adapters, and no new dependency. It needs macOS with Xcode and does not run on the Linux cloud runner.
