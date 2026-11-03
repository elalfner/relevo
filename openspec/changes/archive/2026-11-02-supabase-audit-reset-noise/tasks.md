## 1. Capture

- [x] 1.1 With Docker running, in a project outside the repository with its own ports (another Supabase project may be running on 543xx and must not be touched), run `supabase start`, then `supabase db reset` with a good migration, and save `docker logs --since <timestamp>` of the reset as `tests/fixtures/supabase/db-log-reset.txt` with the absolute path and client addresses as in the other fixtures; stop the project with `supabase stop --no-backup`; add the line to the README of the directory with the versions.

## 2. Audit

- [x] 2.1 In `scripts/lib/logaudit.mjs`, stop `FATAL:  role "postgres" does not exist` from being a `fatal` finding for the postgres flavor and list it in `expected` as a startup entry; every other `FATAL` and `PANIC` stays a finding; verify with tests on `db-log-reset.txt` (quiet reset passes), on `db-log-reset.txt` plus `db-log-error.txt` (rejected on the `ERROR` only) and on `db-log-fatal-handwritten.txt` (still `fatal`).
- [x] 2.2 Make the report word the startup entries apart from the denials; verify with a test of the report text.

## 3. Text

- [x] 3.1 Update `stacks/supabase.md`, `skills/review/SKILL.md` and `docs/commands.md` (and the Spanish page if it carries the sentence) to name the startup entry of a reset; verify `tests/docs-claims.test.mjs` and `tests/skill-review.test.mjs`.
- [x] 3.2 Add a line to the `Fixed` entry under `## [Unreleased]` in `CHANGELOG.md`, and update the "Noise" line of task 6.1 in `docs/pilot-findings.md`.
- [x] 3.3 Run `npm test` and `openspec validate --all`.
