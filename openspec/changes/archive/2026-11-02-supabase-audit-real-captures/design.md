## Context

The captures of 2026-11-03 (CLI 2.122.0, Postgres 17.11) show: a run that passes writes only `create extension if not exists pgtap` and `drop extension if exists pgtap` to the container log; a failing assertion writes nothing; a statement that fails outside `throws_ok`, or a migration with a syntax error, writes `ERROR:` and `STATEMENT:`. Log lines carry `<client ip> <timestamp> UTC [pid] <user>@<db> LEVEL:  message`. `supabase test db` writes `Files=F, Tests=N` and `Result:` on stdout, `# Failed test N: "name"` and `# Looks like you planned N tests but ran M` for failures, and `error running container: exit N` on stderr. This is the first risk the original design named ("the recorded run carries the proof").

## Goals / Non-Goals

**Goals:** make spec, design text and tests agree with the captures; keep the audit's behaviour for errors that do reach the log.
**Non-Goals:** forcing denials into the log (raising `log_min_messages` does not log errors caught in PL/pgSQL), changing the preflight, touching Laravel.

## Decisions

**Accept and adjust.** The expected-denial class stays: a permission, RLS or constraint error can still reach the log from a test that is not pgTAP or from a migration, and it is then counted and not a finding while a run exited 0. The requirement stops saying a policy test provokes them, and the report states that a slice with no denial says nothing about the policy: the recorded run and its assertion names are the evidence. Alternative: remove the class. Rejected: it would turn a real denial from another source into a finding.

**The parser reads what the CLI prints.** The assertion count comes from `Tests=N` of the summary; failing names from `# Failed test N: "name"` lines; an incomplete plan from `Bad plan` or `Looks like you planned`; a file that ran no assertion from `Tests=0`, `skipped` or `No tests run!`. Lines `ok N` and `not ok N` are still read when present (verbose runs), so existing behaviour is a superset.

**The log pattern accepts the real prefix.** Classification is by the level and message after the prefix, so the lines with `<client> <timestamp> UTC [pid] user@db` and the server's own lines without a client both classify.

**Startup noise is out of scope of a slice.** `supabase db reset` writes about a thousand lines, including `FATAL: role "postgres" does not exist` while it recreates the database. The skill already runs reset-log before the test; the report notes that a reset inside the slice may carry that entry and the person can waive it.

## Risks / Trade-offs

- [A policy that never denies passes the audit] → the run's assertions are the proof; the line stays for the person when the pgTAP file asserts no denial for its scenario.
- [Captures come from one CLI version] → the README of the fixtures records versions; the parser reads the stable summary lines.
