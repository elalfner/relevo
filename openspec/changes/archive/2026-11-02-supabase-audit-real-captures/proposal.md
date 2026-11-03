## Why

Tasks 1.2 and 1.3 of `supabase-review-adapter` were run on a machine with Docker (2026-11-03, `docs/pilot-findings.md`). The captures contradict two assumptions of that change: a `throws_ok` denial is caught inside the test and never reaches the container log, and a passing `supabase test db` prints no `ok N` lines. The spec and design say the opposite, and the tests pass only because their fixtures were written from the documentation.

## What Changes

- The audit keeps `FATAL`, `PANIC`, deadlock, out-of-memory and any other `ERROR` as findings, and keeps the class of expected denials for permission, row-level-security and constraint errors that do reach the log. The text no longer says a policy test writes them on purpose.
- The proof that a policy denies is the recorded run (assertions and names), never the log; the report says so when the slice has no denial.
- The pgTAP parser reads the count from `Files=F, Tests=N` and the failing names from `# Failed test N: "name"`, and the spec stops promising `ok N` / `not ok N` lines.
- Tests and fixtures follow the real captures in `tests/fixtures/supabase/`; `db-log-clean.txt` stays marked as not captured.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review`: the Supabase audit requirement and the pgTAP run requirement.

## Impact

- `scripts/lib/logaudit.mjs` (parser and, if needed, the log-line pattern with the `<client> <timestamp> UTC [pid] user@db` prefix), `tests/review-supabase.test.mjs`, `tests/review-autopilot.test.mjs`, `tests/review-waivers.test.mjs` where they read the fixtures.
- `openspec/specs/review/spec.md` (by this delta) and `skills/review/SKILL.md` if it describes denials in the log.
- No new dependency and no change for Laravel.
