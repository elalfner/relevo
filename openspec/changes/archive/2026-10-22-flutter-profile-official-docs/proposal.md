# Proposal

## Why

The plugin's Flutter profile (`stacks/flutter.md`) was written from experience, not from the official Flutter documentation. A reading of docs.flutter.dev (app architecture and its case study, data and backend, testing and debugging, performance, AI) shows that it misses the review rules the docs state plainly (the common layout errors, the performance practices, the web and Wasm constraints), points the agents at the Dart MCP server in a way that no longer holds (`run_tests` and `dart_format` are off by default, and `dart_format` rewrites generated files), and says nothing about architecture. The official "AI rules for Flutter" file it might have leaned on was removed from the Flutter repository on 2026-09-03.

The docs also say the recommended architecture is one option among several ("could've easily been written with streams, or with other libraries such as riverpod, flutter_bloc, and signals"), and that Command and Result are optional. So the profile must not impose an architecture on every Flutter project.

## What Changes

- **Universal hygiene from the docs**: the developer follows, and QA looks for in the diff, the errors of the common-errors page (unbounded `ListView` in a `Column`, `TextField` in a `Row`, misplaced `Expanded`/`Positioned`, `setState` or `showDialog` in `build`, a shared `ScrollController`), the performance practices (lazy builders for long lists, local `setState`, widgets over helper functions, no costly work in `build()`, `Opacity` and clipping kept out of animations, heavy parsing off the UI isolate), the lifecycle rules (no network call or future created in `build()`), the web rules (`package:web` and `dart:js_interop` instead of `dart:html` and `package:js`, no `dart:io` or `Platform` on web), and the testing rules (plugins behind the project's own API, `build_runner` before tests that need generated code).
- **Architecture as a default, not a rule**: the developer follows the architecture the project's rules declare; when they declare none, new code follows the official guide's strongly recommended points (UI and data layers, repositories over stateless services, dependencies passed by constructor and kept private, no data logic in widgets). QA reports an architecture finding only when the diff breaks a rule the project wrote down, or puts network or data access inside a widget. Command and Result are not required by the plugin.
- **Dart MCP server named precisely**: the profile names the tools that are safe for QA (`analyze_files`, `lsp`, `read_package_uris`, and `run_tests` when enabled), the ones no agent runs unattended (`dart_format`, `dart_fix`, `pub`, `hot_reload`, `launch_app` and similar), and falls back to the profile's commands.
- **`generated`** adds `*.mocks.dart` (mockito, which the testing docs use).
- The kept sentences of today's hygiene and audit list stay (mounted, dispose, null assertion, states, double submission, overflow, Android specifics).
- `docs/stacks.md`, `docs/stacks.es.md` and `CHANGELOG.md` describe the new profile.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platforms`: "A stack has a profile" changes the Flutter scenario (the generated files); a new requirement says what the shipped Flutter profile must carry and that it must not impose an architecture.

## Impact

- `stacks/flutter.md` (header `generated`, the whole body; the questions for the issue writer stay).
- `tests/stack-profile.test.mjs` (the list of kept sentences), `tests/stack-profiles-shipped.test.mjs` (checks of the new content).
- `docs/stacks.md`, `docs/stacks.es.md`, `CHANGELOG.md`.
- No change to the commands, the targets, the review autopilot, the agents or the scripts.
