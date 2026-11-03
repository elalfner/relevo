## Context

`supabase db reset` recreates the database in the running container. The log of the slice then holds about a thousand lines of startup and, among them, `FATAL:  role "postgres" does not exist` (captured 2026-11-03, Postgres 17.11, CLI 2.122.0). The recorded run cannot explain it, and a waiver is a decision the person should not have to repeat for a message the CLI itself provokes.

## Goals / Non-Goals

**Goals:** a reset with a good migration gives `REVIEW PASSED` on a quiet log; a reset with a broken migration is still rejected.
**Non-Goals:** filtering the `realtime.schema_migrations` error (an artifact of excluding services in the capture), changing `reset-log`, or classifying other startup lines.

## Decisions

**One message, exact.** The rule matches `FATAL:  role "postgres" does not exist` and nothing broader: the `FATAL` class stays for every other message, so a crash, a terminated connection or a different missing role still rejects. The entry is listed in the report as an expected startup entry with its log line, like the expected denials, and it is not counted as a finding whether or not a run is recorded.

**Captured, not assumed.** The fixture `db-log-reset.txt` comes from a real `supabase db reset` with a good migration on a project with its own ports (another Supabase project runs on 543xx on the machine and is not touched). The test reads it, and a second test appends the `ERROR` of a broken migration from `db-log-error.txt` to prove it still rejects.

**Alternative: `reset-log` after the reset.** Rejected: it would also drop the `ERROR` and `STATEMENT` that the same reset writes for a broken migration, which is the finding the audit exists to catch.
**Alternative: let the person list expected messages.** Rejected, as in the first change: a list in a file is a way to loosen the audit.

## Risks / Trade-offs

- [A future CLI or Postgres changes the message] → the entry becomes a finding again and the person waives it, which is today's behaviour; the fixture README records the versions.
- [The same message from a real fault is hidden] → the message means a client connected with a role that does not exist while the database is being recreated; a real missing role of the app would also log `ERROR`s from the failing statements.
