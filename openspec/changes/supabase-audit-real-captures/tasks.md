## 1. Parser and audit

- [x] 1.1 In `scripts/lib/logaudit.mjs`, make `parseTap` read the count from `Files=F, Tests=N`, the failing names from `# Failed test N: "name"`, the plan from `Bad plan` / `Looks like you planned`, and no assertion from `Tests=0`, `skipped` or `No tests run!`, keeping `ok N` / `not ok N` when present; verify with tests on `tap-pass.txt`, `tap-fail.txt`, `tap-incomplete.txt`, `tap-empty.txt` and `tap-uncaught.txt`.
- [x] 1.2 Make the classification of the Postgres log accept the real prefix (`<client> <timestamp> UTC [pid] user@db LEVEL:`) and the server lines without it; verify with `db-log-uncaught.txt`, `db-log-error.txt` and `db-log-rls-denials.txt`.
- [x] 1.3 Make the Supabase report say, when the run has assertions and the slice has no denial, that the run is the proof; verify with a test for "Policy test that logs nothing".

## 2. Tests and fixtures

- [x] 2.1 Update `tests/review-supabase.test.mjs`, `tests/review-autopilot.test.mjs` and `tests/review-waivers.test.mjs` to the real fixtures (4 assertions, real names) and add a case for a denial that reaches the log with a hand-written line marked as such, since no capture holds one; verify `npm test` passes except the existing `playwrightFacts` failure.
- [x] 2.2 Keep `tests/fixtures/supabase/db-log-clean.txt` marked as not captured in the README; if a capture of an idle slice is cheap on the next Docker session, replace it.

## 3. Text

- [x] 3.1 Update `skills/review/SKILL.md`, `stacks/supabase.md` and `docs/stacks.md` / `docs/stacks.es.md` where they say that policy errors appear in the log; verify `tests/docs-claims.test.mjs` and `tests/skill-review.test.mjs`.
- [x] 3.2 Add the entry under `## [Unreleased]` in `CHANGELOG.md` (Fixed: the Supabase audit and parser follow the real output of the CLI).
- [x] 3.3 Run `npm test` and `openspec validate --all`.
