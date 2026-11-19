# Proposal

## Why

A repository can define its own stack (`.relevo/stacks/<stack>.md`) and `go` builds it, but `review` cannot run for it: the adapter is chosen from a table fixed in the plugin (`flutter/android`, `flutter/web`, `vue/web`, `laravel/-`, `supabase/-`), and any other stack stops the review with "there is no review adapter for the stack". The `review` block of a profile (`log`, `test`, `serve`) only tunes a stack that already has an adapter. A backend that runs in local containers (a database, an API layer, auth and functions) therefore gets the whole flow except the review, and the only way out today is a new adapter inside the plugin for every backend.

Facts read in the code while preparing this change: `adapterFor` in `scripts/lib/review-adapters.mjs` looks up `ADAPTERS[stack/target]` and takes no profile; `review-adapter.mjs` and `doctor.mjs` call it with the stack and the target only; the `review` block parsed by `parseReviewBlock` allows `log`, `test` and `serve`; the generic rules of the `api` adapter (no device, no capture, log read from an offset, a run that exits 0 is `REVIEW PASSED`, no `.env` read) do not mention Laravel or Supabase, but the preflight (`api-preflight.mjs`) and the steps of the skill that prove a line are written for those two stacks; `REMOTE_TEST_RE` that keeps a review local is specific to the Supabase CLI.

## What Changes

- **A profile of the repository can declare an `api` adapter.** The `review` block of `.relevo/stacks/<stack>.md` accepts `adapter: api` and `needs` (the tools the review requires, such as `[node, docker]`), next to the existing `log` and `test`. `adapterFor` reads it only for a stack the plugin has no adapter for.
- **Only `api`.** `device` and `browser` stay in the plugin: they depend on `adb`, a simulator, Playwright and the autopilot flow. A profile cannot declare them.
- **A shipped stack keeps its adapter.** A repository profile of `flutter`, `vue`, `laravel` or `supabase` cannot change the adapter of that stack; `doctor` reports the attempt and the review ignores it.
- **A declared adapter is held to the local rule.** The review proves nothing against a remote system: the `review` block of a declared adapter is refused when `test` or `log` reaches a non-local address, and the review asks the person to confirm in writing, before anything runs, that the data is not production (the same confirmation Laravel asks when its test database is not in-memory).
- **One line at a time only when the command allows it.** `review.test` of a declared adapter may contain `{filter}`. With `precheck` or `verify` the agent proves a line only by running the command with that placeholder replaced by the test that covers the line; without the placeholder it runs the whole suite once at the end and every line stays for the person.
- **A generic preflight.** For a declared adapter the preflight checks that each tool in `needs` is on the path and, for `docker`, that the daemon answers; it installs and starts nothing.
- **`doctor`** checks the declared adapter (the tools, that `log` and `test` are present, that nothing is local-unsafe) and no longer warns that a driven review of that stack is not available.
- **Message and docs.** The stop message for a stack without an adapter says that a repository can declare an `api` adapter in its profile; `docs/stacks.md` and `docs/stacks.es.md` explain it with an example.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the adapter is resolved from the plugin's table or from the `review` block of the repository's profile (only `api`); how a declared adapter is held to the local rule, proves a line and reports a log it cannot read.
- `platforms`: the keys of the `review` block of a profile and the rule that a repository cannot change the adapter of a shipped stack.
- `init-doctor`: the checks `doctor` makes of a declared adapter.

## Impact

- Code: `scripts/lib/review-adapters.mjs`, `scripts/review-adapter.mjs`, `scripts/lib/stack-profile.mjs` (the `review` block), `scripts/lib/api-preflight.mjs` and `scripts/api-preflight.mjs`, `scripts/lib/doctor.mjs`, `scripts/lib/api-log.mjs` and `scripts/lib/logaudit.mjs` (the log of Compose services and the audit of a declared adapter), `scripts/review-state.mjs` and `scripts/lib/review-state.mjs` (the state records the kind of log and the flavor of the audit), and the `api` steps of `skills/review/SKILL.md`.
- Tests: `tests/review-adapters.test.mjs`, `tests/stack-profile.test.mjs`, `tests/api-preflight.test.mjs`, `tests/doctor.test.mjs`, `tests/skill-review.test.mjs`, and a new `tests/review-declared.test.mjs`.
- Documentation: `docs/stacks.md`, `docs/stacks.es.md`, and the plugin notes of the stop message.
- No change to `relevo.yml`, to the `go` workflow or to the shipped profiles. No new dependency.
- Out of scope: a declared `device` or `browser` adapter; a declared `driver` or capture; a profile that replaces the adapter of a shipped stack; shipping the profile of a particular backend in the plugin (a repository writes its own).
- Assumption recorded: the backend that motivated this has, or will have, a local test command that runs against its local instance. If it has none, the declared adapter still reads the log of the containers but proves no line; that is the person's call and is not decided here.
