## Why

A review that runs `supabase db reset` (to apply a migration, for example) leaves `FATAL:  role "postgres" does not exist` in the container log while the database is recreated. The audit counts any `FATAL` as a finding, so the verdict is `REVIEW REJECTED` and the person has to waive a finding that is not a defect, every time. This was observed on 2026-11-03 in the manual review of `supabase-review-adapter` (task 6.1, `docs/pilot-findings.md`).

## What Changes

- The one entry `FATAL:  role "postgres" does not exist` is an expected startup entry: counted and listed in the report, not a finding.
- Every other `FATAL` and `PANIC` stays a finding. The `ERROR` of a broken migration written by the same reset stays a finding.
- A fixture captured from a real `supabase db reset` with a good migration backs the rule.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review`: the requirement "The audit of a Supabase review separates expected denials from errors".

## Impact

- `scripts/lib/logaudit.mjs`, `tests/review-supabase.test.mjs`, `tests/fixtures/supabase/` (new `db-log-reset.txt` and README line).
- `stacks/supabase.md`, `skills/review/SKILL.md`, `docs/commands.md` and `CHANGELOG.md`.
- `openspec/specs/review/spec.md` through the delta. Nothing changes for Laravel.
