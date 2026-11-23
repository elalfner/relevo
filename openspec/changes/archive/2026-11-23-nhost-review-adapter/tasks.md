# Tasks

## 1. The adapter

- [x] 1.1 `tests/review-adapters.test.mjs`: `nhost` has an `api` entry marked `declared`, `adapterFor` fills `log`, `test` and `driver` from the `review` block and keeps `needs`, the stop message names `nhost`; run them and see them fail
- [x] 1.2 `scripts/lib/review-adapters.mjs` and `scripts/review-adapter.mjs`: the entry `nhost/-`, the fill from `review`, the profile resolved when the entry is `declared`; verify 1.1 passes

## 2. The profile

- [x] 2.1 `tests/stack-profiles-shipped.test.mjs`, `tests/stack-profile.test.mjs`: the resolved `nhost` profile (commands, tools, `review`, no targets), a remote override refused, `adapter` and `needs` ignored, a full repository profile merged; add `nhost` where the tests list the shipped stacks (`lens-defects`, `init`, `skill-init-doctor`, `workflow-go`); run them and see them fail
- [x] 2.2 `stacks/nhost.md` (read the Hasura and Nhost documentation for the security items and cite source and date) and `scripts/lib/stack-profile.mjs` (the local rule also for a `declared` entry); verify 2.1 passes

## 3. Doctor and init

- [x] 3.1 `tests/doctor.test.mjs`, `tests/init.test.mjs`: the scenarios of `init-doctor`; run them and see them fail
- [x] 3.2 `scripts/lib/doctor.mjs` and `scripts/lib/init.mjs`; verify 3.1 passes

## 4. Documentation and check

- [x] 4.1 `docs/stacks.md` and `docs/stacks.es.md`: `nhost` in the table of shipped profiles and a paragraph in "Tuning how a stack is reviewed"; verify `tests/docs-claims.test.mjs` passes
- [x] 4.2 Run `npm test` and `openspec validate --all`
