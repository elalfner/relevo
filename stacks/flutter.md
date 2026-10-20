---
stack: flutter
commands:
  analyze: flutter analyze --no-pub
  test: flutter test --reporter=compact --no-pub
  format: dart format
generated: ['*.g.dart', '*.freezed.dart']
tools: [flutter]
requires_skills: []
skills:
  dev: []
  qa: []
  issue: []
  review: []
targets:
  android: adb
  ios: xcrun
  web: ""
---

# Flutter

## Verification

Prefer the Dart tooling server's tools when they are available in this session (analysis, running tests, formatting). Otherwise use the commands of this profile: `analyze`, `test` and `format`.

Do not claim the code compiles, analyses clean or passes tests unless you ran the tools and saw it. If neither the tooling server nor Flutter is available, say so plainly in your report.

## Hygiene for the developer

- Check `mounted` before using a `BuildContext` or calling `setState` after an `await`.
- Dispose every controller, stream subscription and listener you create.
- Avoid the null-assertion operator unless a prior check makes it provably safe.
- Give every screen loading, empty and error states.
- Prevent double submission of actions.
- Keep layouts from overflowing on small screens.
- Write unit and widget tests for the scenarios the platform allows. A scenario that can only be seen on a device or in another app is covered by correct code, and is verified later in the on-device review.

## What the auditor looks for in the diff

- **Async and lifecycle**: a `BuildContext` use or `setState` after an `await` without a `mounted` check.
- **Leaks**: a controller, stream subscription or listener created and never disposed.
- **Null safety**: an unchecked null-assertion operator that can throw at runtime.
- **Layout**: unconstrained content that can overflow on a small screen.
- **States**: missing loading, empty or error states; an action that can be triggered twice.
- **Android specifics**: an external-app launch with no handling for the app being missing, permission use without handling denial, behaviour on the back button.
- **Generated code**: leave generated files (`*.g.dart`, `*.freezed.dart`) out of the review.

## Targets

- `android`: needs `adb`. The bridge to the device for the on-device review. With `review.autopilot`, the agent can drive the app through `flutter_driver`; it needs `lib/main_driver.dart` with `enableFlutterDriverExtension()` and the `flutter_driver` dependency.
- `ios`: needs `xcrun`. It runs only on macOS; builds and reviews for iOS are done there. The review of iOS is not available yet.
- `web`: needs a browser; no extra tool. The review of a web target is always driven (`review.autopilot` must be `precheck` or `verify`) and uses the browser runner.

## Questions for the issue writer

- Which screen is this, and how does the person get to it and leave it?
- What does the person see while data loads, when there is none, when the request fails and when there is no network?
- Which system action does it trigger (a call, a map, a share, a permission)? What if the app for it is missing or the permission is denied?
- Which endpoint does it use and what does its response look like? If it belongs to another repository, name the issue that builds it with `Depends-on:`.
- Which targets must it work on (`android`, `ios`, `web`)?
- Is there a design reference (a picture, a widget to reuse)? Name the file.
- What must work on a small screen?
