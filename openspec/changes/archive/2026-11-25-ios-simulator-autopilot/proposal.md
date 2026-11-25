# Proposal

## Why

In a review of an iOS app the agent only observes: `review-adapter.mjs --target ios` has no driver, `review-state.mjs init` forces the autopilot to `off`, and the person tests every line by hand. With `review.autopilot` set to `precheck` or `verify`, the agent should walk the checklist in the iOS Simulator through the `control` tool of Claude Desktop, with the live panel open so the person watches, and with the guarantees the Android review already has (issue 217).

## What Changes

- The iOS adapter names the `control` tool of the simulator as its driver instead of `null`, and `review-adapter.mjs` prints no notice that the agent cannot drive an iOS app. The output for `android` and `web` does not change.
- `review-state.mjs init` records the configured autopilot for an iOS review instead of forcing `off`. `precheck` and `auto` stay refused until `confirm-env` is recorded, as on Android.
- `skills/review/SKILL.md` gets the iOS driving rules: the closed list of `control` actions, the UDID on every call, coordinates measured on a recent screenshot, waiting for the screen to settle, measuring again after the keyboard, characters that `text` types differently, system dialogs, two failed attempts leave the line to the person, a closed app stops the walk, and the appearance is read first and restored.
- Reading what `control` returns is allowed to drive and to check an action and may be noted in a `precheck`; it never proves a line, and the captures saved by `capture.mjs` are still never opened.
- On iOS `auto` needs a line of the app log or the exit code of a project command; reading the screen gives `precheck` only.
- The requirement "The autopilot has no iOS driver yet" is replaced by this behaviour, and the documentation that says iOS has no driver is rewritten (English and Spanish), including that the allowed actions and the single simulator are an instruction to the agent, not code.
- Out of scope: building and installing the app, `review.setup` and `review.teardown`, new `control` actions such as `open_url`, `flutter_driver` on iOS, physical devices, and any change to the Android flow.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review`: the autopilot on an iOS target gets a driver with its limits; the rules on observing, on the adapter for iOS and on the limits of operating the app change accordingly, and the "no iOS driver yet" requirement is removed.

## Impact

- `scripts/review-state.mjs` (`init`), `scripts/lib/review-adapters.mjs` (`IOS_ADAPTER`, `autopilotNotice`), `scripts/review-adapter.mjs`, and their tests (`review-adapters.test.mjs`, `review-state-ios.test.mjs`, `review-autopilot.test.mjs`).
- `skills/review/SKILL.md`, `docs/commands.md`, `docs/commands.es.md`, `docs/security.md` and its Spanish version, `stacks/flutter.md`.
- `openspec/specs/review/spec.md` at archive.
- No new dependency; `control` is a tool of Claude Desktop.
