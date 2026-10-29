# Tasks

## 1. Check what the design leaves unverified

- [x] 1.1 On a project from `composer create-project laravel/laravel` (the one the pilot used), run `php artisan test`, then a deliberately failing test, and see whether either writes to `storage/logs`; note it in `docs/pilot-findings.md` and keep the output as fixtures for the audit tests
- [x] 1.2 On the same project, run `php artisan test --filter=<name>` with a name that matches one test, several and none, and record how the output reports the count of tests and the exit code of each case (as JSON when not interactive, like the pilot found); the shape goes into the parser of task 3.2
- [x] 1.3 Read which `DB_CONNECTION` and `DB_DATABASE` the fresh project's `phpunit.xml` declares and how the `daily` log channel names its files; the values go into the preflight of task 4.1 and the glob default of task 2.1

## 2. The adapter and the profile

- [x] 2.1 Add `laravel/-` to the table in `scripts/lib/review-adapters.mjs` with kind `api`, make `adapterFor` fall back to `<stack>/-` for a stack with no targets, keep `needsAutopilot` true only for a browser, and replace the "no adapter" reason with the new message (adapters that exist, issue stays `built`, how to tune); verify with cases in `tests/review-adapters.test.mjs` for Laravel, Laravel with autopilot `off`, Supabase and an unknown stack
- [x] 2.2 Add the `review` defaults to the header of `stacks/laravel.md` (`log`, `test`, no `serve`) and the section `Review` to its body; verify `tests/stack-profiles-shipped.test.mjs` for the defaults and that `Targets: None` is unchanged
- [x] 2.3 In `scripts/lib/stack-profile.mjs`, read the `review` block and validate it (known keys only, `serve` with `command` and a `url` on `localhost`), merge the repository's keys over the plugin's and list the replaced ones, keep the section `Review` out of the body for `dev` and `qa`, and print it for the role `review`; verify with tests in `tests/stack-profile.test.mjs` for each scenario of the two new requirements of `platforms` and the modified one
- [x] 2.4 Detect, in the text a repository wrote for review, the phrases that ask for what the block cannot change (skip the audit, mark every line, read an environment file, suggest a waiver, open the pull request) and report them in the resolved profile; verify with a test that lists each phrase and one innocent text that is not reported
- [x] 2.5 Document the profile block in `docs/stacks.md` and `docs/stacks.es.md` (the defaults, `serve`, the section `Review`, what it cannot change) and verify `tests/docs-claims.test.mjs` passes with both pages carrying the same keys

## 3. State and audit

- [x] 3.1 In `scripts/lib/review-state.mjs` and `scripts/review-state.mjs`, record at `init` the size of each file the `log` setting matches (`log_offsets`), add the command `ran <exit-code> [--by person|agent] [--filter <f>] [--tests <n>]` and the field `runs`, and make `precheck` and `auto` of an `api` line require a run with at least one test; verify with tests for a filter that matched none, a run by the person and one by the agent
- [x] 3.2 In `scripts/lib/logaudit.mjs`, add the audit of the `api` kind: read each file from its offset, a new file from its start, report an unreadable file, scan for unhandled exceptions, server errors and database errors, and apply the verdicts of "A recorded test run proves an api review whose log is quiet"; verify with the fixtures of task 1.1 and tests for clean run with empty log, no run, failing run, error in the slice, old entry before the offset and a rolled daily file
- [x] 3.3 Make `review-state.mjs waive` refuse an inconclusive `api` audit and make the PR body of `review` list which runs and lines the person proved and which the agent did; verify with tests in `tests/review-waivers.test.mjs` and `tests/review-autopilot.test.mjs`

## 4. Preflight, server and skill

- [x] 4.1 Write `scripts/api-preflight.mjs` and its library: PHP and Composer found, `vendor/` present and matching `composer.lock`, the database `phpunit.xml` or `phpunit.xml.dist` declares (never the real `.env`), JSON output and an exit code per cause; verify with tests on fixture projects for in-memory SQLite, MySQL, no declaration and no `vendor/`
- [x] 4.2 Let `extra-server.mjs` take `{port}` in the command and the URL of a `serve` block, reusing its free-port, record and stop rules; verify with tests for a busy port and for stopping a server it did not record
- [x] 4.3 Update `skills/review/SKILL.md`: the preflight for `api` without a device, the brief without a shot list, the person's `ran` line, the agent's test per line, the plan of the walk with the `serve` command listed before the confirmation, the audit by slice, and the rule that the section `Review` adds and never loosens; verify `tests/skill-review.test.mjs` passes and add a test that the skill names `api-preflight.mjs` and the `ran` command
- [x] 4.4 Make `review-brief.mjs` take `--kind` and, for the `api` kind, replace the note about appearance with what the person does (run the tests, say `ran <exit code>`) or what the agent does (run the existing test of each line, never write one); the shot list is written by the skill, which skips it for `api` (task 4.3). How many lines a test covers is only known after the agent reads the tests, so it is in the plan of the walk and not in the computed brief; verify with tests in `tests/review-brief.test.mjs`

## 5. Doctor and docs

- [x] 5.1 In `scripts/lib/doctor.mjs`, add the checks of "Doctor checks what an api review needs" and "Doctor checks the review block of a profile", reusing the preflight library, and add the one sentence to `skills/doctor/SKILL.md`; verify with tests in `tests/doctor.test.mjs` for each scenario and that a repository with no Laravel platform gets none of them
- [x] 5.2 Describe the Laravel review in `docs/commands.md`, `docs/execution.md`, `docs/get-started.md` and the Spanish pages: what `review` does for a backend, what the person does with autopilot `off`, the default database rule and how to add a `serve`; correct the sentence in `docs/stacks.md` that says `review` has no adapter for a backend; verify with `tests/docs-claims.test.mjs`
- [x] 5.3 Add the entry under `## [Unreleased]` in `CHANGELOG.md` (Added: the `api` review, the `review` block of a profile; Changed: the stop message of a stack with no adapter) and verify the file keeps the changelog format

## 6. Whole change

- [ ] 6.1 Run a review from the sandbox with `npm pack github:elalfner/relevo#dev` on a Laravel issue, with autopilot `off` and with `verify`, and record in `docs/pilot-findings.md` what was caught, what was not and what was not tried
- [x] 6.2 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged, then run `npm test` and `openspec validate --all` again.
