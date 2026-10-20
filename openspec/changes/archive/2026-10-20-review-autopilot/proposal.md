# Proposal

## Why

`review` today assumes one Android device with `adb`: the preflight is `device.mjs`, the log is `logcat`, the screenshots are `adb` captures, and the skill forbids the agent from operating the app. A repository can now declare a Flutter platform for `android`, `ios` or `web` (the `targets` of the registry) or a Vue platform that is a web app, and for those the review has no way to start: there is no `adb` for a browser, and a person who tests a web page by hand leaves the agent with no log to audit. Facts read in the code:

- `skills/review/SKILL.md` and `scripts/device.mjs` name `adb` in the preflight and the steps; `stacks/flutter.md` lists `targets: android: adb, ios: xcrun, web: ""` but nothing reads the target to choose how the review gets a log.
- The rule "never tap, swipe or type" is written for a phone, and the same rule would forbid any help in a browser.
- `logaudit.mjs` knows Flutter and Android classes; a browser's console errors, page errors and failed requests are not audited.
- `review.mode` and `review.merger` are the only `review.*` settings.
- Playwright and a Chromium are available where the plugin is developed (`/opt/node-tools`), so the browser part can be run for real; there is no Flutter, no `adb` and no device there, so the Flutter driver part cannot.

## What Changes

- **Adapters per target.** A small table (`review-adapters.mjs`, shown by `review-adapter.mjs`) says, for a platform and a target, how the review gets its log and its screenshots and whether it can be driven: Flutter on `android` (device and `adb`, driver), Flutter on `ios` (simulator and `xcrun`, macOS only), Flutter on `web` and Vue on `web` (a browser). A combination that is not supported says so and stops, instead of failing in the middle.
- **A setting for who drives.** `review.autopilot` is `off`, `precheck` or `verify`, and `review.allowed_origins` lists the web origins a driven review may visit besides `localhost`. The default is `off` (see Decisions: it differs from the earlier plan on purpose). The person closes the loop in every mode.
- **`precheck`**: the agent walks the lines, takes the captures and audits, and records its result for each line apart from the person's confirmation (`precheck ok|fail`); the person confirms every line. **`verify`**: the agent may also mark a line `ok (auto)` when the `THEN` was checked by an assertion, a finder or the log; the person confirms the rest and gives the agreement, and the pull request lists what was verified automatically.
- **A web runner.** `web-review.mjs` runs a Playwright script that the agent wrote from the scenarios and `qa` reviewed: in a clean browser profile, blocking every origin that is not allowed, with the credentials taken from environment variable names and redacted from the output, and writing the browser's console errors, page errors and failed requests as a log the audit reads. Each line the script checks comes back `auto-ok` or `auto-fail`; the rest stay for the person.
- **Flutter driver.** For Flutter the agent drives through `flutter_driver` (the Dart and Flutter MCP tools) with fixed rules: never pass `timeout`, fall back to manual if a finder fails twice, no coordinates, no `adb shell input`, no Appium or Maestro, and a written confirmation that the app points to non-production data before starting. `doctor` checks `lib/main_driver.dart` and the dependency.
- **The rule about operating the app changes** from "never" to: on mobile targets only through semantic finders; on the web only in the runner's own browser instance and against allowed origins; never by coordinates, never on third-party sites, never in the person's browser.
- **The audit understands a browser**: console errors, uncaught exceptions, unhandled rejections and failed requests are findings; an empty browser log is inconclusive like any other.
- **`qa` reviews the script** before it runs: each `THEN` it covers has an assertion that would fail if the feature did not exist.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: adapters, autopilot modes, the web runner and the rule about operating the app.
- `configuration`: `review.autopilot` and `review.allowed_origins`.
- `init-doctor`: `doctor` checks what the autopilot needs.

## Impact

- Code: `scripts/lib/review-adapters.mjs` and `scripts/review-adapter.mjs`, `scripts/lib/web-review.mjs` and `scripts/web-review.mjs`, `scripts/lib/review-state.mjs` and `scripts/review-state.mjs`, `scripts/lib/checklist.mjs`, `scripts/lib/logaudit.mjs`, `scripts/lib/config.mjs`, `scripts/lib/doctor.mjs`, `templates/relevo.yml`.
- Content: `skills/review/SKILL.md`, `agents/qa.md`, `stacks/flutter.md`, `docs/commands.md` and `.es.md`, `docs/configuration.md` and `.es.md`, `CHANGELOG.md`.
- Not in this change: reviewing a backend (Laravel), an iOS simulator review beyond saying it is for macOS (nothing can be run here), and recording video. The Flutter driver flow and the Playwright script flow of `verify` have not been tried on a real app; the browser runner is tried against a local page.
