# Supabase review fixtures

Captured on 2026-11-03 from a real run: Supabase CLI 2.122.0, Postgres 17.11, Docker 29.8.2 (OrbStack), a project from `supabase init` with an `orders` table, two RLS policies and pgTAP files in `supabase/tests/`. The absolute path of the project was replaced with `/home/dev/app`. Output of the CLI is stdout and stderr together; the "new version available" notice was removed.

- `tap-pass.txt`: `supabase test db <file>` on a file with 4 assertions, two of them `throws_ok` as `anon` and `authenticated`. All pass. A passing run prints no `ok N` lines: the count is only in `Files=1, Tests=4`.
- `tap-fail.txt`: the same file with one failing assertion (`# Failed test 1: "orders is gone"`); `error running container: exit 1`.
- `tap-incomplete.txt`: a plan of 3 of which 2 ran (`Bad plan`).
- `tap-empty.txt`: a file with `plan(0)`: `finish()` raises `No tests run!`, the file is `skipped`, exit 1.
- `tap-uncaught.txt`: a file whose statement fails outside `throws_ok` (missing relation): `Dubious, test returned 3`, `Tests=0`.
- `db-log-rls-denials.txt`: the container log (`docker logs --since`) of the passing run. The denials provoked by `throws_ok` are NOT in it: only the `create extension pgtap` and `drop extension pgtap` statements are. The name is kept for the tests that expect denials.
- `db-log-uncaught.txt`: the container log of the run in `tap-uncaught.txt`: an `ERROR` with its `STATEMENT`.
- `db-log-error.txt`: a migration with a syntax error applied by `supabase db reset`.
- `db-log-clean.txt`: NOT captured; still written from the documentation. Lines carry no client address or `user@db` prefix, unlike the real ones.
- `db-log-denials-handwritten.txt` and `db-log-fatal-handwritten.txt`: NOT captured. No capture holds a denial (`throws_ok` does not log) or a `FATAL` / deadlock, so these are written in the real line format for the tests of those classes.
- `db-log-reset.txt`: an excerpt of the container log of a `supabase db reset` with a good migration (CLI 2.122.0, Postgres 17.11, captured 2026-11-03): the startup with `FATAL:  role "postgres" does not exist`, and the end with the migration statements. The ~1,250 lines between them were cut, and the `realtime.schema_migrations` error was removed because the capture excluded the realtime service.
