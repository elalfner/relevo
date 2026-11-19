# Design

## Context

See proposal.md for the motivation. How things work today, read in the code:

- `adapterFor({ stack, target })` in `scripts/lib/review-adapters.mjs` looks up the fixed table `ADAPTERS` (`flutter/android`, `flutter/web`, `vue/web`, `laravel/-`, `supabase/-`); a stack with no targets is keyed `<stack>/-`. It takes no profile. `scripts/review-adapter.mjs` and `scripts/lib/doctor.mjs` (the autopilot check tests `adapterFor(...).kind === 'api'`) call it.
- The profile is resolved by `resolveProfile` in `scripts/lib/stack-profile.mjs`: the plugin's `stacks/<stack>.md` merged with `.relevo/stacks/<stack>.md`. `parseReviewBlock` allows `log`, `test`, `serve`; `mergeProfiles` lets the repository replace any review key.
- An api review runs through `review-state.mjs`: `init --adapter api --stack --log --cwd` snapshots the log (`snapshotLog`: file offsets, or `docker:<name>` plus a start time read with `docker logs --since`); `confirm-env` records the person's written word that the data is not production, and `assertDriving` refuses `ran --by agent`, `precheck` and `auto` without it; a line is proved only by an agent run for that line that exited 0 and recorded `--tests >= 1`.
- `api-preflight.mjs` has a Laravel mode (exits 3 to 6) and a Supabase mode (exits 3, 4, 5, 7). Its `which` runs `<tool> --version`.
- The audit (`auditApi`) has two flavors: Laravel entries by default, `postgres` when `state.stack === 'supabase'`.

The case that motivates the change is a backend whose services (a database, an API layer, auth and a functions service) run in the containers of one Docker Compose project. Its gate is two npm scripts, `analyze` and `test:integration`; the second needs the instance up, recreates test data, cannot be filtered (its auth service limits sign-ins) and runs against a disposable local instance. It has no device and no screen.

## Goals / Non-Goals

**Goals:**
- A repository gets the `api` review for a backend stack of its own by writing its profile, with no release of the plugin.
- A declared adapter keeps every guard of Laravel and Supabase: local only, the person's word, no `.env`, no written tests, a log read from the start of the review, a recorded run as the proof.

**Non-Goals:**
- A declared `device` or `browser` adapter, a `driver` or a capture; an `nhost` profile shipped by the plugin.
- Detecting that an opaque command reaches production: the plugin refuses what it can see and asks the person for the rest.
- Starting, stopping or seeding the instance the tests need.

## Decisions

### 1. The adapter is resolved from the profile only when the table has no entry for the stack

`adapterFor` gains an optional `review` argument (the resolved `review` block). The table is looked up first, exactly as today. Only when it has no entry for the stack, no target is given and `review.adapter === 'api'` does it return `{ supported: true, kind: 'api', declared: true, log, capture: null, driver: review.test, test, needs }`. `review-adapter.mjs` and `doctor` call `resolveProfile` only for a stack without a table entry, so a broken repository profile of `laravel` cannot newly stop a review, and an invalid profile of a repository-only stack stops it with the errors as the `reason` (exit 1, the issue stays `built`).

The table is the definition of "the plugin ships an adapter". `mergeProfiles` drops `adapter` and `needs` of the repository when the plugin has a profile for the stack and records them in `ignored` (which `doctor` already warns about); a test asserts that every stack with a plugin profile has a table entry, so the two layers cannot disagree.

Discarded: letting the declaration override a shipped adapter (a repository could relabel how a shipped stack is reviewed, and the proposal forbids it); reading profiles inside the static table.

### 2. A declaration is validated in two places

`parseReviewBlock` checks what one file shows: `adapter` is only `api`; `needs` is a list of names matching `^[A-Za-z0-9][A-Za-z0-9._-]*$`, so `./x` or `a b` is refused; a profile of the plugin cannot use either key. `resolveProfile` checks what needs the merged profile, only when `review.adapter` is `api`: `log` and `test` present, no `targets`, and the local rule of decision 3. A missing `test` therefore reads as a profile error and not as "no adapter".

Discarded: validating in `adapterFor` (profile errors would look like an unsupported stack and `doctor` would not report them as an invalid profile).

### 3. What counts as a non-local address

For a declared adapter `review.test` and `review.log` are refused when they hold a token of the existing remote list (`--linked`, `--db-url`, `link`, `push`, `pull`, the `REMOTE_TEST_RE` of `stack-profile.mjs`) or a `scheme://host` whose host is not `localhost`, `127.0.0.1` or `[::1]` (the pattern `serve` already uses, `LOCAL_URL_RE`). A host that the text does not spell out (`https://$HOST/`, `http://${URL}`) is refused too, because it cannot be shown to be local. A bare host (`psql -h db.example.com`) or an address that an environment file defines is not detected: the command is opaque, so this is a tripwire, like the checks of `serve`, and the guard that matters is decision 4. The URL rule applies only to a declared adapter, so the shipped profiles do not change; the remote-flag rule keeps applying to every profile.

### 4. The written confirmation reuses `confirm-env` and is asked whenever the agent will run something

Laravel asks only when its test database is not in-memory SQLite (preflight exit 6, from a file it read); Supabase never asks because its tests only touch local containers. A declared command can reach anything and the plugin reads nothing, so the confirmation is always asked, but only when the agent is about to run a command: with `review.autopilot` `off` the person runs the test in their terminal and nothing is asked, as in Laravel. The mechanism is the existing one: the person's written yes, then `review-state.mjs confirm-env`, and `assertDriving` already refuses the agent's runs without it. `review-adapter.mjs` prints `declared: true` so the skill knows to ask; the preflight does not carry it, because tools and data are different questions. The same message asks the person to say that the local instance is up. The agent never starts or stops it: it cannot know what starts what.

Discarded: a new preflight exit code for "ask" (Laravel's exit 6 means a database was read; here nothing was); never asking (the command is unbounded); asking in `off` (the person is the one who runs).

### 5. `{filter}` is one test name in the place the project chose; no placeholder means no per-line proof

`{filter}` is read only in `review.test` of a declared adapter (the shipped stacks have their own way: `--filter`, a pgTAP file). The agent replaces every occurrence with one test name matching `^[A-Za-z0-9_./:#@-]+$`, so no space or shell character reaches the command; a test whose only name does not match is left to the person with a note. The run is recorded as the Laravel one is (`ran <exit> --by agent --line <n> --tests <n> --filter <name>`). The count is read by the agent from the output of the runner; if the output has none, the existing rule (`tests >= 1`) refuses the proof. Without `{filter}` the agent proves no line, runs the whole suite once at the end (`ran <exit> --by agent --tests <n>`) and the person confirms every line. For that backend this is the only mode, which also respects the sign-in limit of its auth service: one full run per audit cycle, never a loop. The micro-fix loop reruns the suite once and records it, and the latest run replaces the one before as it already does.

Discarded: appending `--filter` to an unknown command (it means something different in each runner, or nothing); running the suite until a line passes (it would hammer a rate-limited Auth and prove nothing per line).

### 6. The preflight is generic: `api-preflight.mjs --needs a,b`, and it executes none of the tools

The new mode validates the names with the pattern of decision 2, because the list comes from the repository, then looks for an executable of each name in the directories of `PATH` without running it; for `docker` it also runs `docker info`, as the Supabase mode does. Exit 3 names the missing tools, exit 4 says the daemon does not answer (the codes the Supabase mode already uses), exit 0 is ready. It installs, starts and reads nothing; it prints an install hint only for the tools it knows (`docker`). The Laravel and Supabase modes are untouched. `doctor` uses the same lookup.

The existing `which` runs `<tool> --version`; for a name the repository chose that would execute a program of its choice and fail for tools without that flag, so the generic mode does not use it.

Discarded: parameterising `supabasePreflight` (it requires `supabase/config.toml` and `supabase status`); checking that the instance is up (it needs a stack-specific command, and decision 4 asks the person).

### 7. The log of Compose services, read since the review started

An instance's log is spread over containers of one Compose project whose names are not stable (`<project>-<service>-1`), so `docker:<name>` does not fit. `log` accepts `compose:` followed by comma-separated service names (`compose:postgres,api,auth,functions`); `compose:` alone is every service; names follow the pattern of decision 2. `snapshotLog` records `{ source: 'compose', services, since }` at `init` and `readSlice` runs `docker compose logs --no-color --since <since> <services>` from the folder of the platform, where the Compose file lives (the `backend` platform's folder for Nhost). It only reads: nothing is restarted, truncated or recreated, which is also what bounds the audit to what arrived after `init`. A non-zero exit (no Compose file, daemon down, unknown service) is an unreadable source, so the verdict is `REVIEW INCONCLUSIVE` and cannot be waived: the review never passes on a log it could not read.

`docker compose` may interpolate a `.env` of that folder by itself. The plugin does not read the file; if Compose cannot start without it, the log is unreadable and the review inconclusive, never a false pass.

### 8. The audit of a declared adapter has a flavor with only the common signals

The Laravel flavor would find nothing in a Postgres or API-gateway log, and the `postgres` flavor carries Supabase's reset noise. A flavor `declared`, chosen from the state, flags: `FATAL`/`PANIC`, a deadlock, out of memory, a database `ERROR` that is not a denial, and an HTTP status of 500 or above (the Laravel flavor's 5xx pattern). Permission denials and constraint violations are listed as expected while a run is recorded, as `postgres` does. An error with none of those signals, such as the JSON `"level":"error"` that a service writes for any rejected request, is not a finding, because it would reject every review that tests a denial; the report says that such errors are not detected. The recorded run stays the main proof, as in the other `api` reviews, and an empty slice with no run stays inconclusive.

Discarded: a list of patterns in the profile (a second language to validate and a way to loosen the audit); the Laravel flavor (finds nothing, passes any log).

### 9. Doctor

For a declared platform: the tools of `needs` (found on `PATH`, `docker` with `docker info`, reusing the existing stopped-engine warning), the invalid-profile failure that `resolveProfile` already produces, a note when `{filter}` is missing and the autopilot is not `off`, and the `ignored` entries for a shipped stack. The autopilot branch tests `adapterFor(...).kind === 'api'`, so it passes once it receives the declared adapter. `doctor` never starts the instance or runs `compose`.

### 10. Messages and documentation

`NEXT_STEP` in `review-adapters.mjs` gains one sentence naming the declaration. `docs/stacks.md` and `docs/stacks.es.md` get a section after "Tuning how a stack is reviewed" with an example profile (`adapter: api`, `needs: [node, docker]`, `log: compose:...`, `test: npm run --silent test:integration`, with no `{filter}`) and what it implies: no per-line proof, one run at the end, the written confirmation, the instance started by the person.

### 11. The base branch

The declared `test` is a command the agent runs. The profile file is already protected from an unattended run (a change to it ends in `qa-failed`) and `doctor` already warns when the file is not tracked; nothing is added.

## Risks / Trade-offs

- [A command reaches production through an environment file or a bare host and passes the tripwire] → the written confirmation before any run by the agent; with autopilot `off` the person is who runs it.
- [Only common signals are audited, so an API or functions error without them is missed] → the report says so, the person confirms every line, and the recorded run is the proof, as in Supabase.
- [No `{filter}` means no line is marked automatically] → `doctor` and the docs say it; whether to add a filter to the project's script is the project's call.
- [`docker compose logs` needs variables from a `.env` the plugin will not read] → an unreadable log and an inconclusive verdict, never a false pass.
- [The agent reads the test count from the output of an arbitrary runner] → no count, no proof; the person confirms the line anyway.
- [`ios-review-adapter` also modifies the requirement that picks the adapter] → both deltas rewrite the same block; whichever is archived second must be merged by hand.

## Migration Plan

Additive. No setting changes and no change to the shipped profiles; a repository that declares nothing sees the same behavior, with one added sentence in the stop message. Rollback is removing `review.adapter` from the profile.

## Open Questions

- Whether that backend can run `docker compose logs` without its `.env`. It changes the project's Compose file, not this design; until it can, its review is inconclusive on the log.
