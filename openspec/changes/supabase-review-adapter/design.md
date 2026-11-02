# Design

## Context

See proposal.md for the motivation. What exists today:

- `review` resolves an adapter from `stack/target` in `ADAPTERS` of `scripts/lib/review-adapters.mjs`. The `api` kind exists for `laravel/-`; `adapterFor` falls back to `<stack>/-` for a stack with no targets. `supabase/-` has no entry, so the preflight stops.
- The `api` kind is Laravel-shaped in four places: `review-state.mjs init --adapter api` defaults `--log` to `storage/logs/*.log` and snapshots file sizes (`api-log.mjs`); `auditApi` (`logaudit.mjs`) scans for Laravel entries; `api-preflight.mjs` checks PHP, Composer, `vendor/` and `phpunit.xml`; the skill names those commands.
- The profile of `supabase` has `tools: [supabase, docker]`, `test: supabase test db`, `analyze: supabase db lint`, no targets and `review: []` for skills. Its body says all tests run against local Docker containers and never against a remote project. `docs/execution.md` says two Supabase builds must not share a machine because they start containers on the same ports.
- The `review` block of a profile (`log`, `test`, `serve`) and the section `Review` are read by `stack-profile.mjs`; a repository's keys replace the plugin's. `log` is a path or glob.
- The agent never writes code in a review, never reads environment files, and starts servers only through `extra-server.mjs`.

## Goals / Non-Goals

**Goals:**

- A repository with a Supabase platform can run `/relevo:review` with no configuration beyond what it already has, and reach the pull request.
- A review of a database change never touches a remote project, whatever the folder is linked to.

**Non-Goals:**

- Calling the REST API, Auth, Storage or edge functions of the local stack as a user. That is the `serve` idea of Laravel and would need keys, users and seed data; it is a follow-up.
- Applying migrations to staging or production, `db push`, `db pull`, `link`, or anything remote.
- Writing or editing pgTAP tests in a review. If a line has no test the person confirms it.
- `flutter/ios`, and changes to the Laravel adapter's behaviour.

## Decisions

**Reuse the kind `api`, add the key `supabase/-`.** `{ kind: 'api', log: 'docker:supabase_db_{project_id}', capture: null, driver: 'supabase test db', needs: ['supabase', 'docker'] }`. The kind means "no device, no screen, a checklist proved by the project's tests and a log"; nothing in it is PHP-specific except the places listed above, which become per-stack. Alternative: a new kind `database`. Rejected: `needsAutopilot`, the brief, the state's `runs`, `precheck`/`auto` rules and the PR body all key on `api`, and a second kind would copy them for no behaviour difference.

**The preflight branches by stack, not by tool sniffing.** `api-preflight.mjs` takes the stack of the platform (`--stack`, read from `platform-of.mjs` by the skill) and runs the Laravel checks or the Supabase ones. Supabase exits: `3` CLI or Docker missing, `4` Docker installed but the daemon does not answer, `5` no `supabase/config.toml`, `7` local stack not running. `6` (database needs confirmation) is never returned for Supabase. `7` is not a stop: the skill follows the "Local stack stopped" scenario. Checks use `supabase --version`, `docker info` and `supabase status` (exit code only); none reads `.env`. Alternative: reuse `EXIT.vendor`/`deps_stale` numbers for Supabase causes. Rejected: the skill gives the person a different command per cause and a shared number would mix them.

**The stack is started only with the person seeing it.** `supabase test db` needs the local database up. With autopilot `off` the person starts it. With `precheck` or `verify` the plan of the walk lists `supabase start` before the person confirms, the agent runs it, and records that it did so in the review state (`started_stack: true`); `supabase stop` runs at the end only when that is set. Alternative: always start it. Rejected: starting containers pulls images and takes ports, which is a side effect on the person's machine, and stopping a stack the agent did not start would kill the person's own work.

**Local only is enforced by what the agent may run, not by trusting the folder.** `supabase test db` without `--linked` or `--db-url` runs against the local containers even when the folder is linked. The review commands are a closed list: `supabase test db [files]`, `supabase db lint`, `supabase status`, `supabase start`/`stop` (if the agent started it), `docker logs`, `docker inspect`. `review.test` is validated: a value with `--linked`, `--db-url`, `link`, `push` or `pull` makes the profile invalid. `supabase/.temp/` and `.env` files are never read, so the agent does not learn the project ref. Alternative: check that the folder is not linked. Rejected: a linked folder is the normal state of a project with a staging project, and refusing it would block most real repositories.

**The log is the database container's, read from a timestamp.** The local Postgres runs in the container `supabase_db_<project_id>`, with `project_id` from `supabase/config.toml`. `review.log` gets a second form, `docker:<name>` with `{project_id}` substituted. `review-state.mjs init` records for it `{ source: 'docker', container, since: <ISO timestamp> }` instead of file sizes, and the audit reads `docker logs --since <timestamp> <container>`. A clock difference between host and container is covered by recording the timestamp from `docker info`'s clock only if task 1.2 shows a skew; otherwise the host clock is used. Nothing is cleared or restarted: the container belongs to the person. If the container does not exist, the audit reports an unreadable source and does not return `REVIEW PASSED` on its account, as for a missing file. Alternative: `supabase logs`. Rejected: the CLI command targets the hosted project's logs, not the local stack. Alternative: no log, only pgTAP. Rejected: the log is how the review catches a migration that logged errors while a test still passed, and it keeps the audit shape the same as Laravel's.

**Expected denials are counted, not findings.** A pgTAP test of a policy uses `throws_ok`, `results_eq` after `set role anon` and similar, so a green run writes `ERROR: new row violates row-level security policy`, `permission denied for table` and constraint violations to the container log on purpose. Treating every `ERROR` as a finding would reject every good RLS review. The audit lists those three classes as expected denials with a count while a recorded run exited 0; with a failing run they stay in the report as context. `FATAL`, `PANIC`, deadlocks, out-of-memory and any other `ERROR` (missing relation, syntax error, function failure) are findings, waivable by the person. Alternative: ignore all `ERROR`. Rejected: a migration with a typo that a test did not hit would pass. Alternative: let the repository list expected messages. Rejected for now: the three classes cover what a policy test does, and a list in a file is a way to loosen the audit; see Open Questions.

**A pgTAP run is its own record.** `supabase test db [files]` prints TAP: `ok N - name`, `not ok N - name`, `1..N` and `# Looks like you ...`. `review-state.mjs ran` already records an exit code; for Supabase the agent records the parsed result (files, assertions, failing names, plan completed) from the output. A run with zero assertions, or whose plan was not completed, counts as a run that ran no test, the same rule as a filter that matches nothing in Laravel. The "filter" of a line is the pgTAP file that covers it, chosen by the agent by reading `supabase/tests/`; no naming rule, for the reason Laravel gave. A person's `ran <code>` is recorded without assertions.

**The profile carries the defaults.** `stacks/supabase.md` gets `review: { log: docker:supabase_db_{project_id}, test: supabase test db }` and a section `Review` saying what the adapter does, that a line is proved by the pgTAP file of its scenario, that policy errors in the log are expected, and that the review never targets a remote project. The `review.test` validation is shared with Laravel's and applied only when the value contains the flags above, so it costs Laravel nothing.

## Risks / Trade-offs

- [Container log does not hold the errors] → If Postgres logs at a level that omits statement errors, the slice is empty even for a bad migration, and the recorded run carries the proof. Task 1.1 checks what a failing statement and a policy denial write at the default level of the local stack; the design stands if both appear, and if not the audit relies on the run and the report says so.
- [Clock skew between host and container] → `--since` uses the container's clock. Task 1.2 measures it on the sandbox's Docker; if there is skew the timestamp is read from the container, not the host.
- [Docker is not in the sandbox or CI of this repository] → The unit tests use fixtures of TAP output and of container logs, and fake `docker`/`supabase` binaries on the path as the Laravel tests did for `php`. A real run is a manual task on a machine with Docker (task 6.1) and is recorded as such in the pilot findings.
- [Two Supabase reviews or builds on one machine collide on ports] → Already documented for builds. The preflight reports a running stack that belongs to another `project_id` as an unknown container and does not stop it.
- [A policy test that does not assert the `THEN` of a line] → Same rule as Laravel: with `verify` a line is `ok (auto)` only when the exit code proves its `THEN`; a test that only checks the table exists does not prove a scenario about who can read it, and the line stays for the person.
- [The agent starts the stack and the review crashes] → The state keeps `started_stack`; `review-state.mjs` and the skill's ending stop it, and `doctor` does not have to know.

## Migration Plan

Additive. A repository with no Supabase platform sees nothing change. A Supabase repository that stopped at the old "names no target" message now proceeds. Rolling back means removing the `supabase/-` entry, the Supabase branch of the preflight and the `docker:` form; the review state gains optional fields (`log.source`, `started_stack`) that older versions ignore.

## Open Questions

- Whether a repository should be able to extend the list of expected denial messages from `.relevo/stacks/supabase.md`. It would help a project with custom exceptions raised by `raise exception` in functions its tests provoke, and it is a way to loosen the audit. Decide after the first real use.
- Whether `supabase db lint` belongs in the review as well as in QA. It is already a gate of the build; the review adds the person's confirmation, not another gate.
