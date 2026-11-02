# Supabase review fixtures

These files were written from the Supabase CLI and pgTAP documentation. They were NOT captured from a run: the sandbox that built the `supabase-review-adapter` change has no Docker daemon, so `supabase start` could not run. Task 1 of that change stays open as a follow-up on a machine with Docker; replace these files with real captures then, and keep the tests passing.

- `tap-pass.txt`: `supabase test db` on a file with 6 assertions, all passing.
- `tap-fail.txt`: the same file with one failing assertion.
- `tap-incomplete.txt`: a plan of 6 assertions of which 4 ran.
- `tap-empty.txt`: a run that matched no test file (no assertion).
- `db-log-rls-denials.txt`: the database container log of a passing policy test: the `throws_ok` and `set role anon` assertions provoke permission and RLS errors on purpose.
- `db-log-error.txt`: a migration that references a table that does not exist, a fatal entry, and a deadlock.
- `db-log-clean.txt`: routine entries only.
