# Proposal

## Why

A repository with a Supabase platform cannot finish an issue the way a Laravel one now can. `/relevo:go` builds the issue and QA runs `supabase db lint` and `supabase test db`, but `/relevo:review` stops in its preflight: the stack `supabase` has no targets and no review adapter, so the stop says that the platform "names no target to review". The review is the step that moves an issue from `built` to `pr-open`, so a database change (a migration, an RLS policy, a pgTAP test) is stuck before the pull request. The pilot of the Laravel adapter left this stack as the next one without an adapter, and the Laravel adapter (`api`) already solved the same shape of problem: no device, no screen, a checklist proved by the project's own tests.

## What Changes

- Add a review adapter for the stack `supabase`, of the existing kind `api`, keyed `supabase/-`. It needs no device and no browser. The checklist still comes from the scenarios, and the person still confirms every line.
- With `review.autopilot` `off` the person runs `supabase test db` and says so (`ran <exit code>`). With `precheck` or `verify` the agent runs the pgTAP file that already covers a line (`supabase test db <file>`), never writes or edits a test, and records the file, the number of assertions that ran and the exit code. A line with no pgTAP file is left to the person.
- The audit reads the slice of the local database container's log written since the review started (by timestamp, not by file offset), and keeps the rule that a recorded passing run proves a quiet log. The audit knows that a pgTAP test of a policy provokes `permission denied` and `row-level security` errors on purpose: those are counted and listed as expected denials, not findings; `FATAL`, `PANIC`, a deadlock and any other `ERROR` are findings.
- A preflight, `scripts/api-preflight.mjs` for the Supabase kind, checks the Supabase CLI, a reachable Docker daemon, `supabase/config.toml` and that the local stack is running. It never reads `.env` files, starts nothing without the person seeing it in the plan, and refuses `--linked` and `--db-url`: a review only ever touches the local containers.
- Let the `review` block of a profile carry a log source that is a container (`docker:<name>`) as well as a file path, with `{project_id}` replaced from `supabase/config.toml`. The plugin's `supabase` profile sets `log`, `test` and a section `Review`; a repository can tune them in `.relevo/stacks/supabase.md` as it does for Laravel, and `test` cannot name `--linked` or `--db-url`.
- `doctor` checks what the Supabase review needs and reports a `review` block that is malformed or that points the review at a remote database.
- Replace "the adapters that exist are ..." in the stop message with a list that includes Supabase, and document it in `docs/stacks.md`, `docs/commands.md` and the Spanish pages, with an entry in the changelog.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the adapter table includes `supabase`; an `api` review proves a line with a test file as well as a test filter; the log of an `api` review can be a container read from a timestamp; expected denials of a pgTAP run are not findings; the preflight of an `api` review covers the Supabase tools and refuses a remote database.
- `platforms`: the plugin's `supabase` profile carries the `review` defaults and a section `Review`; `review.log` may name a container; `review.test` cannot target a remote database.
- `init-doctor`: `doctor` reports what the Supabase review needs and a `review` block that targets a remote database.

## Impact

- `scripts/lib/review-adapters.mjs` and `scripts/review-adapter.mjs`: the `supabase/-` entry and the stop message.
- `scripts/lib/api-log.mjs`, `scripts/lib/logaudit.mjs`, `scripts/review-state.mjs` and `scripts/lib/review-state.mjs`: a container log source with a `since` timestamp, the Postgres classes with the expected denials, the pgTAP run recorded with its assertions count.
- `scripts/lib/api-preflight.mjs` and `scripts/api-preflight.mjs`: a Supabase branch chosen by the platform's stack, with its own exit codes.
- `scripts/lib/stack-profile.mjs`: validation of the `docker:` log form and of `review.test`.
- `scripts/lib/doctor.mjs`: the new checks. `skills/review/SKILL.md` and `skills/doctor/SKILL.md`: the steps for this adapter. `stacks/supabase.md` gets the `review` defaults and the section `Review`.
- Tests under `tests/`, the docs in both languages and `CHANGELOG.md`.
- No change to the build, QA, fix or ship, no change to the Laravel adapter's behaviour, and no new dependency. The Supabase CLI and Docker are already required by the profile (`tools: [supabase, docker]`).
