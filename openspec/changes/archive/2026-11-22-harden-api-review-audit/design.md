# Design

## Context

`readSlice` in `scripts/lib/api-log.mjs` runs one `docker compose logs --since <t> <services>` through `defaultRun`, a `spawnSync` with no `maxBuffer`, so the output of every service shares Node's default of 1 MiB. `newState` in `scripts/lib/review-state.mjs` stores no owner, and `review-state.mjs init` writes the file without looking at one that exists. `reset-log` takes a new snapshot and keeps `state.runs`, whose entries carry no position relative to the window. The preflight of a declared adapter (`needsPreflight`) looks at the PATH and the Docker daemon only, and Relevo has no reference to the working directory that Compose records on its containers (`com.docker.compose.project.working_dir`). See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- The audit reads a heavy Compose log without failing as a whole, and says which service and why when one still fails.
- A checkout without dependencies or environment file, a state of another change, and an instance of another checkout are named before a long run, not after it.
- A window that nobody exercised is never `REVIEW PASSED`.

**Non-Goals:**
- Streaming or windowing a single service's log. A service whose log exceeds the cap is reported, and `reset-log` is the way out.
- Warning before the volume breaks the read. It would need a size estimate Docker does not give cheaply.
- Stopping the review for a Compose directory mismatch or a missing environment file: both can be legitimate.
- Reading `.env`, installing dependencies, or touching the instance.

## Decisions

**1. Per service, 256 MiB each.** `readSlice` lists the services (`docker compose config --services`) when the setting names none, then runs `docker compose logs --no-color --since <t> <service>` for each, with `maxBuffer` of 256 MiB (the value `check-store.mjs` already uses). Output is concatenated with each line prefixed by Compose, as now. Failures are collected per service into `unreadable` with the service name. *Alternative: one call with a larger buffer.* It moves the failure and still loses every service when one is large. *Alternative: stream to a file.* More code for a case `reset-log` already answers.

**2. The ENOBUFS reason is translated.** When a read fails with `ENOBUFS`, the `unreadable` reason says that the service's log is larger than the read allows, that `reset-log` starts a window from now, and that the runs recorded so far stop proving the new window (decision 5), so the suite runs again. The verdict stays `REVIEW INCONCLUSIVE`; it is still not waivable.

**3. Preflight checks paths, never content.** `needsPreflight` takes `exists(path)` and the folder. With `npm` in `needs` and a `package.json`, `node_modules` must exist. `.env` must exist only when `.env.example` or `.env.sample` does, which is a signal the project expects one without opening any file. Results go in a `warnings` list of the output, and the exit code is a new non-stop value (5, "ready, with warnings"), like exit 6 of Laravel and 7 of Supabase. The review skill names each warning and asks before any test or server runs. *Alternative: stop (exit non-zero).* A project with no `.env` is legitimate, and a stop would block it.

**4. Compose directory by `docker compose ps -q` and `docker inspect`.** For a `compose:` log, `ps -q` run in the folder finds the running containers of its project and `inspect` reads the `com.docker.compose.project.working_dir` label Compose recorded on them, compares it with the resolved folder of the platform (both through `realpath`), and returns a warning with both paths and, when `git` answers in each, the branch. `init` prints it and the preflight returns it in `warnings`. If it cannot be read, a note says so; no failure. *Alternative: compare branch only.* The directory is the fact Docker has; the branch is added for the person.

**5. A run belongs to a window.** `snapshotLog` records `runsBefore: state.runs.length` when `reset-log` takes a new snapshot (0 at `init`). `auditApi` gets `windowStart` and, when `windowStart > 0` and `runs.length === windowStart`, returns `REVIEW INCONCLUSIVE` with the reason "no test run is recorded since the log was reset". Failing runs of the latest-per-line rule still count over all runs, so a failure before the reset stands until a later run replaces it. *Alternative: timestamp each run.* More state, and the index already orders runs and windows.

**6. State owner.** `newState` stores `change` (basename of the change folder) and `kind`. `init` refuses when the file exists with another `change` or `kind`, saying which, and overwrites only a state of the same change (a deliberate restart). `owner <change-dir>` prints the verdict for the skill's resume step. A state with no `change` is "unknown", not a mismatch. The issue number is not stored: the review skill resolves it from the change, so the change name is the stable key.

## Risks / Trade-offs

- [One service larger than 256 MiB still fails] → named in the report with the `reset-log` way out.
- [`.env` heuristic misses a project whose example is named differently] → the preflight only warns, and never claims the environment is right.
- [The project name the folder resolves to differs from the running one] → `ps -q` then finds nothing and the note says no running project was found for this folder; any failed read falls back to a "could not tell" note.
- [Inconclusive after every `reset-log`] → intended: the person records a run after the fix, as the review already asks.

## Migration Plan

No data migration. A state file written before this change has no `change`, and is treated as of unknown owner. Rollback is reverting the commit.
