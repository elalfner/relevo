---
stack: flutter
commands:
  analyze: flutter analyze --no-pub
  test: flutter test --reporter=compact --no-pub
  format: dart format
generated: ['*.g.dart', '*.freezed.dart', '*.mocks.dart']
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

Run the commands of this profile from the folder of the platform: `analyze`, `test` and `format`. Run `format` on the files you changed, never on generated files.

When the Dart and Flutter MCP server is connected, you may use the tools that write nothing: `analyze_files` for analysis, `lsp` and `read_package_uris` to check an API or a symbol instead of guessing it, and `run_tests` when the server enables it (it is off by default). When a tool is missing, use the command of this profile. No agent uses `dart_format`, `dart_fix`, `pub`, `hot_reload`, `hot_restart` or `launch_app` during a run: they write files or drive an app, and `dart_format` formats the whole project, generated files included.

When annotated models or mocks changed, run `dart run build_runner build --delete-conflicting-outputs` before the tests.

Do not claim the code compiles, analyses clean or passes tests unless you ran the tools and saw it. If neither the tooling server nor Flutter is available, say so plainly in your report.

## Architecture

Follow the architecture that the project's rules declare (MVVM, bloc, riverpod or another). When they declare none, write new code with the structure of Flutter's architecture guide: UI and data in separate layers; data reached through repositories, which call stateless services that wrap each API or plugin; dependencies passed by constructor and kept private; no data logic in widgets. Command and Result objects, and any state-management package, are not required by this profile; use them when the project's rules do.

## Hygiene for the developer

Lifecycle and state:

- Check `mounted` before using a `BuildContext` or calling `setState` after an `await`.
- Dispose every controller, stream subscription and listener you create. A `ChangeNotifierProvider(create:)` disposes its model itself.
- Never call an API, create a future or show a dialog inside `build()`; start them in `initState` or in an event handler.
- Avoid the null-assertion operator unless a prior check makes it provably safe.
- Give every screen loading, empty and error states.
- Prevent double submission of actions.

Layout:

- Keep layouts from overflowing on small screens: wrap a long `Text` or other unconstrained child of a `Row` or `Column` in `Expanded` or `Flexible`.
- Give a `ListView` or `GridView` inside a `Column` a bound (`Expanded` or a fixed height), and a `TextField` inside a `Row` a width (`Expanded` or `SizedBox`).
- Put `Expanded` and `Flexible` directly in a `Row`, `Column` or `Flex`, and `Positioned` directly in a `Stack`.
- Give each scroll view its own `ScrollController`.

Performance:

- Build long lists and grids with the builder constructors, not with a list of children.
- Keep `build()` cheap, and call `setState` as low in the tree as the change allows.
- Split large widgets into smaller widget classes rather than helper methods that return widgets.
- Keep `Opacity` and clipping out of animations; use `AnimatedOpacity` or a semi-transparent colour.
- Move heavy work, such as decoding a large JSON response, off the UI isolate with `Isolate.run`. On the web it still runs on the main thread.

Web:

- Use `package:web` and `dart:js_interop`; `dart:html` and `package:js` prevent the Wasm build.
- Do not use `dart:io` or `Platform` in code that runs on the web; check `kIsWeb` or use a conditional import.

Tests:

- Write unit and widget tests for the scenarios the platform allows. A scenario that can only be seen on a device or in another app is covered by correct code, and is verified later in the on-device review.
- Make fakes of repositories and services for tests; a mock is also acceptable. A plugin throws `MissingPluginException` in unit and widget tests, so put it behind the project's own class and fake that class.

## What the auditor looks for in the diff

- **Async and lifecycle**: a `BuildContext` use or `setState` after an `await` without a `mounted` check; a network call, a new future, `setState` or `showDialog` inside `build()`.
- **Leaks**: a controller, stream subscription or listener created and never disposed.
- **Null safety**: an unchecked null-assertion operator that can throw at runtime.
- **Layout**: unconstrained content that can overflow on a small screen; a `ListView` or `GridView` in a `Column` without a bound; a `TextField` in a `Row` without a width; `Expanded`, `Flexible` or `Positioned` outside a compatible parent; one `ScrollController` attached to several scroll views.
- **States**: missing loading, empty or error states; an action that can be triggered twice.
- **Performance**: a long list built from a list of children; costly work in `build()`; `setState` high in the tree for a local change; `Opacity` or clipping inside an animation; a large JSON decode on the UI isolate.
- **Web**: an import of `dart:html` or `package:js`; `dart:io` or `Platform` in code that runs on the web.
- **Tests**: a test that calls a real plugin, network or service instead of a fake or a mock.
- **Architecture**: report only what breaks a rule the project wrote down. Whatever the project declares, an HTTP or GraphQL client called from a widget is a finding.
- **Android specifics**: an external-app launch with no handling for the app being missing, permission use without handling denial, behaviour on the back button.
- **Generated code**: leave generated files (`*.g.dart`, `*.freezed.dart`, `*.mocks.dart`) out of the review.

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
