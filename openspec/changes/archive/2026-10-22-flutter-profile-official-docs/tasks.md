# Tasks

## 1. Profile

- [x] 1.1 In `stacks/flutter.md`, add `'*.mocks.dart'` to `generated`. Leave the commands, tools, skills and targets as they are.
- [x] 1.2 Rewrite `## Verification`: the profile's commands from the platform's folder; the Dart MCP server's read-only tools (`analyze_files`, `lsp`, `read_package_uris`, `run_tests` when enabled) with the fallback to the commands; no agent uses `dart_format`, `dart_fix`, `pub`, `hot_reload`, `hot_restart` or `launch_app` during a run; format with the profile's `format` on the changed files; `dart run build_runner build --delete-conflicting-outputs` before tests when annotated models or mocks changed; keep "Do not claim the code compiles, analyses clean or passes tests unless you ran the tools and saw it".
- [x] 1.3 Add an architecture part (inside `## Hygiene for the developer` or as its own `##` before it): follow the architecture the project's rules declare; with none, new code keeps UI and data layers, reaches data through repositories over stateless services, passes dependencies by constructor and keeps them private, and puts no data logic in widgets; Command, Result and any state-management package are not required by this profile.
- [x] 1.4 Extend `## Hygiene for the developer` with the groups of the spec: layout (the common errors), performance (lazy builders, local `setState`, widgets over helper functions, nothing costly or a new future in `build()`, `Opacity` and clipping out of animations, heavy parsing off the UI isolate with `Isolate.run`, noting that on web it runs on the main thread), web (`package:web` and `dart:js_interop`, no `dart:io` or `Platform` on web), tests (plugins behind the project's own API in unit and widget tests, fakes for repositories and services). Keep every kept sentence.
- [x] 1.5 Extend `## What the auditor looks for in the diff` with the same groups as checks, the rule that an architecture finding needs a written project rule, and the exception for network or data access in a widget. Keep every kept sentence. Leave `## Targets` and `## Questions for the issue writer` as they are.
- [x] 1.6 Check every rule against the sources listed in `design.md`; drop any rule that does not trace to them or to a kept sentence. Verify the body (after the header) is at most 8 KB.

## 2. Tests

- [x] 2.1 In `tests/stack-profile.test.mjs`, replace the kept sentence "Prefer the Dart tooling server" with the new MCP sentence; keep the others. Verify with `node --test tests/stack-profile.test.mjs`.
- [x] 2.2 In `tests/stack-profiles-shipped.test.mjs`, add a Flutter test for the spec's scenarios: `*.mocks.dart` in `generated`; the body names `ListView`, `Column`, `TextField`, `Row`, `setState` in `build`, `ScrollController`, a builder for long lists, `Opacity`, `Isolate.run`, `dart:html`, `package:web`, `analyze_files`, `dart_format`; it does not require `Command`, `Result`, `provider` or `freezed`; it does not mention "AI rules"; the body is at most 8 KB. Verify with `node --test tests/stack-profiles-shipped.test.mjs`.

## 3. Documentation

- [x] 3.1 In `docs/stacks.md` and `docs/stacks.es.md`, describe what the Flutter profile covers now (the rules from the official docs, architecture only as the project declares it or as a default, the MCP tools QA may use) and that project rules such as Command and Result go in the project's rules. Verify with `node --test tests/readme-sync.test.mjs tests/docs-claims.test.mjs`.
- [x] 3.2 Add the entry under Unreleased in `CHANGELOG.md` (Changed: the Flutter profile follows the official docs as read on 2026-10-22; `*.mocks.dart` is generated). Verify with `node --test tests/changelog.test.mjs`.

## 4. Check

- [x] 4.1 Run `npm test` and `openspec validate flutter-profile-official-docs --strict`. Verify every test passes and validation reports no error.
- [x] 4.2 Resolve the profile with `node scripts/stack-profile.mjs` for `dev` and for `issue` in a throwaway repository with a Flutter `relevo.yml`, and check that the body has the new groups and the questions are only in the `issue` output.

## Workflow follow-up

- Archive the change after review, syncing the delta into `openspec/specs/platforms/spec.md`.
- Separate change, not this one: move the review autopilot from `flutter_driver` to `integration_test`.
