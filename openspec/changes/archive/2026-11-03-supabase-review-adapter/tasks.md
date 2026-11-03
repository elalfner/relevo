# Tasks

## 1. Check what the design leaves unverified

- [x] 1.1 On a project from `supabase init` with a table, an RLS policy and a pgTAP file that tests the policy with `throws_ok` and `set role anon`, run `supabase start` and `supabase test db`; read `docker logs supabase_db_<project_id>` for the run, for a deliberately failing assertion and for a migration with a syntax error, and note in `docs/pilot-findings.md` which lines each writes at the default log level; keep the outputs as fixtures for the audit tests. If Docker is not available in the sandbox, say so there and write the fixtures from the Supabase CLI and pgTAP documentation, marked as not captured from a run.
- [ ] 1.2 (open: the sandbox has no Docker daemon, see docs/pilot-findings.md) On the same project, record the exit code and the TAP output of `supabase test db` for: all files, one file, a file that does not exist, a file with no assertion and a plan that is not completed; and compare the clock of `docker logs --since` with the host's. The shapes go into the parser of task 3.2 and the timestamp rule of task 3.1.
- [ ] 1.3 (open: needs a running stack) Read `supabase/config.toml` of the fresh project for `project_id` and check how the container name is built (`supabase_db_<project_id>`), and what `supabase status` exits with when the stack is stopped and when it runs; the values go into tasks 2.1 and 4.1.

## 2. The adapter and the profile

- [x] 2.1 Add `supabase/-` to `scripts/lib/review-adapters.mjs` (kind `api`, log `docker:supabase_db_{project_id}`, driver `supabase test db`, needs `supabase` and `docker`), update `EXISTING` and the stop message to list Supabase, and keep `needsAutopilot` true only for a browser; verify with cases in `tests/review-adapters.test.mjs` for Supabase, Supabase with autopilot `off`, Laravel unchanged and an unknown stack.
- [x] 2.2 Add the `review` defaults to the header of `stacks/supabase.md` and a section `Review` to its body; verify `tests/stack-profiles-shipped.test.mjs` for the defaults and that the commands and `tools` are unchanged.
- [x] 2.3 In `scripts/lib/stack-profile.mjs`, accept `docker:<name>` in `review.log` with `{project_id}`, and refuse a `review.test` that contains `--linked`, `--db-url`, `link`, `push` or `pull`; verify with tests in `tests/stack-profile.test.mjs` for each scenario of the modified requirement of `platforms`, including the remote flags.
- [x] 2.4 Document the profile in `docs/stacks.md` and `docs/stacks.es.md` (the Supabase defaults, the `docker:` log form, the local-only rule) and verify `tests/docs-claims.test.mjs` passes with both pages carrying the same keys.

## 3. State and audit

- [x] 3.1 In `scripts/lib/api-log.mjs`, `scripts/lib/review-state.mjs` and `scripts/review-state.mjs`, add the container source: `init` records `{ source: 'docker', container, since }` (the container name resolved from `supabase/config.toml`), `reset-log` takes a new timestamp, and `readSlice` runs `docker logs --since` through an injectable runner and reports a missing container as unreadable; verify with tests using a fake runner for a clean slice, a slice with entries, entries before the timestamp, a missing container and Docker not running.
- [x] 3.2 In `scripts/lib/logaudit.mjs`, add the Postgres classes: `FATAL`, `PANIC`, deadlock and out-of-memory as findings, permission, row-level-security and constraint errors as expected denials while the latest run exited 0, any other `ERROR` as a finding; add the parser of pgTAP output for `ran` (files, assertions, failing names, plan completed); verify with the fixtures of tasks 1.1 and 1.2 and tests for each scenario of "The audit of a Supabase review separates expected denials from errors" and "A pgTAP run is recorded with its assertions".
- [x] 3.3 Make `precheck` and `auto` of a Supabase line require a run with at least one assertion, and make the PR body list the pgTAP file and the count for each line proved; verify with tests in `tests/review-autopilot.test.mjs` for a file that ran no assertion, a run by the person and one by the agent, and `tests/review-waivers.test.mjs` for waiving a finding and refusing an inconclusive audit.

## 4. Preflight and skill

- [x] 4.1 Extend `scripts/lib/api-preflight.mjs` and `scripts/api-preflight.mjs` with `--stack supabase`: CLI, Docker installed, daemon answering, `supabase/config.toml`, local stack running, with the exit codes of the design, never reading `.env`, injectable `which`/`run`/`exists`; verify with tests for each exit code and for Laravel unchanged.
- [x] 4.2 Add the closed list of commands a Supabase review may run and refuse the others (`--linked`, `--db-url`, `link`, `db push`, `db pull`, reading `supabase/.temp`); verify with tests that each refused command is refused and each allowed one passes.
- [x] 4.3 Update `skills/review/SKILL.md`: the preflight with `--stack` and the new exit codes, the plan of the walk listing `supabase start` and the pgTAP files, running `supabase test db <file>` per line and recording the parsed run, the local-only rule, and stopping only a stack the agent started; verify `tests/skill-review.test.mjs` passes and add a test that the skill names `--stack`, `supabase test db` and `started_stack`.
- [x] 4.4 Update `review-brief.mjs` so the `api` note speaks of pgTAP files when the stack is Supabase; verify with tests in `tests/review-brief.test.mjs`.

## 5. Doctor and docs

- [x] 5.1 In `scripts/lib/doctor.mjs`, add the checks of "Doctor checks what a Supabase review needs" and the changes to "Doctor checks the review block of a profile" (remote flags, missing container), reusing the preflight library, and add the sentence to `skills/doctor/SKILL.md`; verify with tests in `tests/doctor.test.mjs` for each scenario and that a repository with no Supabase platform gets none of them.
- [x] 5.2 Describe the Supabase review in `docs/commands.md`, `docs/execution.md`, `docs/get-started.md`, `docs/install.md` and the Spanish pages (what `review` does for a database change, what the person does with autopilot `off`, that it is local only, what a stopped stack means); verify with `tests/docs-claims.test.mjs`.
- [x] 5.3 Add the entry under `## [Unreleased]` in `CHANGELOG.md` (Added: the Supabase review; Changed: the stop message and the `review.log` forms) and keep the changelog format.

## 6. Whole change

- [ ] 6.1 (open: needs Docker) Run the review by hand on the project of task 1.1 with `review.autopilot` `verify`, calling the scripts in the order the skill gives, and record in `docs/pilot-findings.md` what was caught and what was not tried; if Docker is not available in the sandbox, record that this is a follow-up for a machine that has it.
- [ ] 6.2 (`openspec validate --all` passes; `npm test` has one failure that exists without this change, the `playwrightFacts` test in `tests/doctor.test.mjs`) Run `npm test` and `openspec validate --all` and verify both pass.

## Workflow follow-up

- After the merge, review a real Supabase issue with `/relevo:review` from `npm pack github:elalfner/relevo#dev` in a repository with a Supabase platform and Docker, with `review.autopilot` `off` and with `verify`, and add to `docs/pilot-findings.md` what the model did with the skill, what was caught and what was not.
- Archive the change after the pull request to `dev` is merged, then run `npm test` and `openspec validate --all` again.
