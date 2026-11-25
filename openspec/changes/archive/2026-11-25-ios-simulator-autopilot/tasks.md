# Tasks

## 1. Adapter and state

- [x] 1.1 In `scripts/lib/review-adapters.mjs` set the driver of `IOS_ADAPTER` to the `control` tool of the simulator and make `autopilotNotice` return `null` for iOS; update `scripts/review-adapter.mjs` comments. Verify with `review-adapters.test.mjs`: iOS output names the driver, `notice` is null for `off`, `precheck` and `verify`, and the `android` and `web` outputs are unchanged.
- [x] 1.2 In `scripts/review-state.mjs` `init`, record the configured autopilot for an iOS review instead of `off`. Verify with `review-state-ios.test.mjs`: `init --target ios --autopilot precheck` records `precheck`, and `precheck` and `auto` are refused until `confirm-env` and (for `auto`) require `verify`; `review-autopilot.test.mjs` still passes.
- [x] 1.3 Run `npm test` and confirm the suite passes.

## 2. Agent rules and documentation

- [x] 2.1 Rewrite the iOS paragraph, "What you must never do", step 2 and the Autopilot section of `skills/review/SKILL.md`: the closed `control` action list, `attach` first, UDID on every call, coordinates, waiting for the screen, the keyboard, hyphen, system dialogs, two failures, app closed, appearance, screen reading, `auto` only with log or command, and the report contents. Verify by grepping the file for each rule and for the absence of "no iOS driver".
- [x] 2.2 Update `docs/commands.md`, `docs/commands.es.md`, `docs/security.md`, its Spanish version and `stacks/flutter.md` to describe the iOS autopilot, that the person starts the simulator and the app, and that the action list and single simulator are an instruction, not code. Verify with `grep -rni "no ios driver\|no driver yet\|sin driver" docs stacks skills` returning nothing.
- [x] 2.3 Run `npm test` and `openspec validate --all` and confirm both pass.

## Workflow follow-up

- Test in the sandbox with a booted simulator and `review.autopilot` `precheck`: the panel shows "Claude is using this device", lines stay pending until the person writes `ok`, and the appearance is the same at the end. Test data by name, never real data.
- Archive the change after review, then run `openspec validate --all`.
