# Tasks

## 1. Profile

- [x] 1.1 `tests/stack-profile.test.mjs`: the scenarios of `platforms` (valid, invalid shapes, reserved words, unsafe characters, ignored on a shipped stack, no default for `nhost`, printed by `--role review`); run them and see them fail
- [x] 1.2 `scripts/lib/stack-profile.mjs`: the key, its validation, honored only for a declared adapter, ignored otherwise; verify 1.1 passes

## 2. Audit

- [x] 2.1 `tests/review-declared.test.mjs`: the scenarios of `review` (listed, unlisted, fatal, deadlock and out of memory, 5xx, no run, `init` refusing the flag for a non-declared review, empty list, the report); run them and see them fail
- [x] 2.2 `scripts/lib/logaudit.mjs`, `scripts/lib/review-state.mjs`, `scripts/review-state.mjs`: the list in the state, the check, the report; verify 2.1 passes

## 3. Doctor and skill

- [x] 3.1 `tests/doctor.test.mjs`: the scenarios of `init-doctor`; run them and see them fail
- [x] 3.2 `scripts/lib/doctor.mjs` and `skills/review/SKILL.md` (`init` passes `--expected-error`, the audit text, the waiver stays the person's); verify 3.1 passes

## 4. Documentation and check

- [x] 4.1 `docs/stacks.md`, `docs/stacks.es.md`, `stacks/nhost.md` (section Review) and `CHANGELOG.md` (Unreleased); `tests/docs-claims.test.mjs` passes
- [x] 4.2 `npm test` and `openspec validate --all --strict` pass
