# Tasks

## 1. The key in the profile

- [x] 1.1 In `scripts/lib/stack-profile.mjs`, add `expected_fatals` to `REVIEW_KEYS`, a validator `expectedFatalProblem` (3 to 100 characters from the same alphabet, no `PANIC`, deadlock, out of memory, `HTTP` or 5xx status, not starting with `FATAL`), the list check in the review block, and the key to the plugin-profile refusal loop. Verify: unit tests for the scenarios "Valid list", "Not a list of strings", "Unsafe characters", "Reserved word", "No default for Nhost" and "The plugin's own profile".
- [x] 1.2 Drop the key and list it as ignored when the stack is not a declared adapter, and print it with `stack-profile.mjs --role review`. Verify: unit tests for "Shipped stack that is not declared" and "Printed for the review".

## 2. The audit

- [x] 2.1 In `scripts/lib/logaudit.mjs`, add `ownExpectedFatal(line, entries)` (whole-message equality after trimming and collapsing whitespace, null for a line with `PANIC`, a deadlock, out of memory or a 5xx status) and use it in the declared branch of `auditApi` before the `PG_RULES` loop: excused with a run recorded, a `fatal` finding without one. Verify: unit tests for "Autovacuum ended by the harness", "No run recorded", "A longer or shorter message", "Unlisted fatal" and "Fatal signal on a listed message", and that `expected_errors` behaviour is unchanged.
- [x] 2.2 Add the paragraph of the expected fatals, with each entry and its count, to `auditReport`. Verify: a unit test checks the paragraph, the counts and the sentence about the repository's declaration.

## 3. The state

- [x] 3.1 In `scripts/review-state.mjs` and `scripts/lib/review-state.mjs`, add `--expected-fatal <text>` to `init` (repeatable, only with `--declared`, validated), store `expectedFatals` in the state and pass it to `auditApi` in `audit`. Verify: command tests for "Not a declared adapter", an invalid entry refused by `init`, and a review that goes from `init` with an entry to `REVIEW PASSED` on a log with the autovacuum fatal and to `REVIEW REJECTED` on another fatal.

## 4. Doctor

- [x] 4.1 In `scripts/lib/doctor.mjs`, note the number of declared fatals, warn when the key is ignored, and let an invalid entry surface as an invalid profile. Verify: unit tests for the scenarios of "Doctor reports the expected fatals a repository declares" and "Doctor warns when expected_fatals is ignored or invalid".

## 5. Skill and documentation

- [x] 5.1 Update `skills/review/SKILL.md` so the review passes each entry of `review.expected_fatals` to `init` as `--expected-fatal`, and never adds one. Verify: the tests that read the skill still pass and the text names `--expected-fatal`.
- [x] 5.2 Update `docs/stacks.md` and `docs/stacks.es.md` (the section on declaring a review adapter and the `nhost` profile) with the key, the whole-message rule and the autovacuum example, and add a line under `Unreleased` in `CHANGELOG.md`. Verify: `npm test` passes, including the checks that compare the English and Spanish documents.
- [x] 5.3 Run `npm test` and `openspec validate --all`. Verify: both exit 0.
