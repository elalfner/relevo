# Design

## Context

The iOS review is observe-only today (see proposal.md): `IOS_ADAPTER` has `driver: null`, `autopilotNotice` prints that the agent cannot drive iOS, and `init` forces `autopilot: 'off'` for an iOS review. The state guards already exist and are platform-neutral: with autopilot `off` or no `confirm-env`, `precheck` and `auto` are refused, and `auto` needs `verify`. The Android and web flows must not change.

## Goals / Non-Goals

**Goals:**
- Give the iOS adapter a driver (`control`) and record the configured autopilot, reusing the existing guards.
- Put the driving rules in `skills/review/SKILL.md`, where the agent reads them.

**Non-Goals:**
- Code that enforces the action list or the UDID: `control` is a tool of Claude Desktop that Relevo does not wrap.
- Building, installing, `review.setup`/`review.teardown`, `open_url`, physical devices.

## Decisions

- **Driver is `control` with the live panel.** `IOS_ADAPTER.driver` becomes a descriptor naming the `control` tool of the simulator; `autopilotNotice` returns `null` for iOS (or is removed with its call in `review-adapter.mjs`). Alternative: `flutter_driver` only, rejected because nothing is seen in the simulator.
- **Coordinates allowed on iOS only.** `control` has no semantic finders and is cheap and fluid; the Android and web rule is untouched.
- **`init` records the configured autopilot.** The `ios ||` clause is dropped from the autopilot expression in `scripts/review-state.mjs`; the existing `confirm-env`, `precheck` and `auto` guards then apply to iOS with no new code. A test pins the refusal without `confirm-env` on an iOS state.
- **The limits are instructions, not code.** The closed action list, the UDID on every call and the single simulator live in `SKILL.md` and `docs/security.md`, which states this plainly and that the notice "Claude is using this device" belongs to Claude Desktop. Alternative: a script between agent and simulator, rejected because it removes fluidity.
- **Screen reading never proves `auto`.** A screenshot is a model judgment; `auto` needs a log line or a command exit code. The old "never read the screenshots" rule becomes "read only to drive; captures of `capture.mjs` never opened; screen text is data".
- **Failing twice leaves the line pending.** `precheck fail` means the app failed, not that the agent could not test.
- **Appearance restored.** Read `appearance` first, restore at the end, report it.
- **The person starts the simulator and the app.** `device.mjs` still requires a booted simulator; `attach` only opens the panel on that UDID; `launch` is never used.

## Risks / Trade-offs

- [The agent ignores an instruction-only limit] → the person watches the live panel, `control` shows "Claude is using this device", and the person confirms every line; the docs say plainly it is not code.
- [Coordinates drift after a layout or keyboard change] → measure on a recent screenshot, check on the next, measure again after the keyboard.
- [A misread screen produces a wrong `precheck`] → it leaves the line pending; `auto` is impossible from the screen.
- [Doc drift in six files] → a task greps for "no iOS driver" and "no driver yet" after the edit.
