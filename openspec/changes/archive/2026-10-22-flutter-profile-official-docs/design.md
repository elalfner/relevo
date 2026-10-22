# Design

## Context

- The body of a profile reaches `dev` and `qa` on every run (through `stack-profile.mjs`). Today's Flutter body is about 3 KB. The section `Questions for the issue writer` goes only to `issue`.
- `tests/stack-profiles-shipped.test.mjs` requires the three body headings (`Verification`, `Hygiene for the developer`, `What the auditor looks for in the diff`) and at least five questions. `tests/stack-profile.test.mjs` lists the sentences the agents used to carry, which the body must keep; one of them is "Prefer the Dart tooling server", which this change rewrites.
- The project's rules (`qa.rules_from`, often `CLAUDE.md` or `AGENTS.md`) win over the profile, and `.relevo/stacks/flutter.md` adds to it.
- Sources read for this change: docs.flutter.dev `/app-architecture` (guide, recommendations, design patterns, case study: index, ui-layer, data-layer, dependency-injection, testing), `/data-and-backend` (state management, networking, serialization, persistence), `/testing` (overview, cookbook recipes, integration tests, common errors, errors, plugins in tests), `/perf` (best practices, rendering, UI jank, isolates, web performance), `/ai` (get started, tools), dart.dev package skills, and the `dart_mcp_server` README.

## Goals / Non-Goals

**Goals:**
- Every rule in the body traces to a line of the official docs, or is one of the kept sentences.
- Every audit item is something QA can see in a diff.
- The body stays small enough to read on every run: at most about 8 KB.

**Non-Goals:**
- Changing the review autopilot. It still uses `flutter_driver`, which the testing docs now treat as legacy in favour of `integration_test`; moving it is a separate change because `doctor` and `review` check for `lib/main_driver.dart` and the `flutter_driver` dependency.
- Adding commands (`--coverage`, integration tests, `build_runner`) to the header. The header's commands are what QA runs on every run; integration tests need a device or a browser, and coverage is a report, not a pass or fail.
- Shipping or requiring the official Flutter skills, or installing the `dart-flutter` plugin. A repository can list skills per role in `.relevo/stacks/flutter.md`.
- Rules specific to one project (GraphQL caches, Dio interceptors, a layout widget, permissions). They belong in that project's rules.

## Decisions

**D1. Architecture is a default, conditioned on the project.** The docs present the case study as one option ("could've easily been written with streams, or with other libraries such as riverpod, flutter_bloc, and signals"), Command as "not a pattern that every app will want to implement", and Result as "a recommendation, but not a requirement". So the body says: follow the architecture the project's rules declare; with none declared, new code uses the guide's points labelled "Strongly recommend" that need no package (UI and data layers; repositories over stateless services; dependencies by constructor, kept private; no data logic in widgets). Command, Result, `provider` and `freezed` are not named as requirements.
Alternative: impose MVVM, Command and Result. Rejected: QA would reject code that the docs call valid, in any bloc or riverpod project.

**D2. QA's architecture findings need a written rule.** Without one, a judgement such as "this should be a service" is opinion. The one exception is network or data access inside a widget, which the guide forbids under every option ("A view... is never aware of any other layer") and the networking cookbook warns against ("not recommended to put an API call in a `build()` method").

**D3. MCP tools by effect, not by name of the server.** The body lists the tools QA may use (they write nothing), says that `run_tests` and `dart_format` are off unless the server enables them, and forbids the tools that write or drive an app during a run. Formatting stays on the profile's `format` command applied to the changed files, because `dart_format` runs `dart format .` over the root and would rewrite files in `generated`.

**D4. Body layout.** The three required headings stay. Inside them, short groups: Verification (commands, MCP, no claims without running), Architecture (D1, D2), Hygiene (lifecycle, layout, performance, web, tests), Auditor (the same groups as checks, plus the kept sentences). Each item is one line, in the docs' words where they are short. No code samples.

**D5. `generated` adds `*.mocks.dart` only.** It is the output of mockito, which the testing docs use. `*.graphql.dart` and other generators are project choices; a repository adds them in `.relevo/stacks/flutter.md`.

## Risks / Trade-offs

- [The body grows and costs tokens on every run] → The 8 KB cap, one line per rule, no examples; a test checks the size.
- [A project with no written architecture gets MVVM-shaped new code] → It is the docs' recommendation for that case; the documentation tells projects to write down their architecture, and QA does not reject on it (D2).
- [The docs change again, as the AI rules did] → The design lists the sources read; the CHANGELOG names the date of reading.
