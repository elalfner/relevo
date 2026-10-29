# Proposal

## Why

A repository with only a Laravel platform cannot finish an issue. `/relevo:go` builds it and QA passes, but `/relevo:review` stops in its preflight because the profile of `laravel` defines no target and no review adapter exists for a backend. The stop says that the platform "names no target to review" and nothing about what to do next, and the review is the step that moves an issue from `built` to `pr-open`, so the work is stuck before the pull request. The pilot already listed it as "not tried: a Laravel review (there is no adapter)". A stack the plugin does not ship, defined only in `.relevo/stacks/`, has the same hole.

## What Changes

- Add a review adapter `api` of kind `api`, picked for a platform whose stack is `laravel`. It needs no device and no browser. The checklist still comes from the scenarios, and the person still confirms every line.
- With `review.autopilot` `off` the person runs the tests and writes `ok` or `fail` per line. With `precheck` or `verify` the agent runs the existing feature test that covers a line, never writes a test, and records the test name and exit code as the proof. A line with no test is left to the person.
- The audit reads the slice of the Laravel log written since the review started, not the whole file, and a passing run that wrote nothing to the log is a pass when a test run was recorded. An empty log with no recorded run stays `REVIEW INCONCLUSIVE`.
- Let a repository tune the adapter from the header of `.relevo/stacks/<stack>.md`: a `review` block with the log path, the base test command and an optional `serve` (command, URL and variables of a server the agent starts on its own port). A section `Review` in the body of the same file adds free instructions for the agent. Both add to the plugin's profile and cannot loosen a rule of the review.
- Replace the stop message "no adapter" with one that says what is supported and, for a stack without an adapter, how to tune one.
- `doctor` checks what the `api` adapter needs (PHP, Composer, installed dependencies, the database `phpunit.xml` points to) and reports a `review.serve` that is malformed.
- Document it in `docs/stacks.md`, `docs/commands.md` and the Spanish pages, and add the entry to the changelog.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: a backend adapter, the rule that a recorded test run proves a quiet log, the audit by log slice, and a clear stop for a stack without an adapter.
- `platforms`: the profile header may carry a `review` block and the body a `Review` section, which the repository adds and which never loosen the fixed rules of the review.
- `init-doctor`: `doctor` reports what the `api` review needs and a malformed `review` block.

## Impact

- `scripts/lib/review-adapters.mjs` and `scripts/review-adapter.mjs`: the new adapter and the new stop message.
- `scripts/lib/logaudit.mjs`, `scripts/review-state.mjs` and `scripts/lib/review-state.mjs`: log offset, slice audit and the recorded test run.
- `scripts/lib/stack-profile.mjs` and `scripts/stack-profile.mjs`: reading and merging the `review` block and the `Review` section.
- `scripts/lib/doctor.mjs`: the new checks. A new script `scripts/api-preflight.mjs` checks the tools and the test database before a review of this kind.
- `skills/review/SKILL.md`: the steps for the `api` kind. `stacks/laravel.md` gets the `review` defaults.
- Tests under `tests/`, the docs in both languages and `CHANGELOG.md`.
- No change to the build, QA, fix or ship, and no new dependency.
