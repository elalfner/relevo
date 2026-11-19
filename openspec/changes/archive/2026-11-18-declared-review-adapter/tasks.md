# Tasks

## 1. The profile declares an adapter

- [x] 1.1 In `parseReviewBlock` (`scripts/lib/stack-profile.mjs`) allow `adapter` (only `api`) and `needs` (a list of names matching `^[A-Za-z0-9][A-Za-z0-9._-]*$`), and refuse both in a profile of the plugin. Verify in `tests/stack-profile.test.mjs`: valid declaration; `adapter: browser` and `adapter: device` fail naming `review.adapter` and the one value allowed; `needs: docker` and `needs: ["./tools/run"]` fail naming `review.needs`; a plugin profile with `adapter` fails.
- [x] 1.2 In `resolveProfile`, when the merged `review.adapter` is `api`, require `log` and `test` and refuse a profile that defines `targets`. Verify with cases for a missing `log`, a missing `test` (the error names the key) and a stack with targets.
- [x] 1.3 Add the local rule for a declared adapter to `resolveProfile`: `review.test` and `review.log` fail for `--linked`, `--db-url`, `link`, `push`, `pull`, a `scheme://host` whose host is not `localhost`, `127.0.0.1` or `[::1]`, and a host that is a variable. Verify that `https://api.example.com`, `https://$HOST/graphql` and `--db-url` fail naming `review.test`, `http://127.0.0.1:8080` passes, and that the same URL in a shipped stack's `test` is not newly refused.
- [x] 1.4 Accept `compose:<services>` in `log` (names with the pattern of 1.1, none meaning every service). Verify that `compose:postgres,auth` resolves and `compose:postgres;rm` fails naming `review.log`.
- [x] 1.5 In `mergeProfiles`, drop `adapter` and `needs` of the repository when the plugin has a profile for the stack and list them in `ignored`, keeping the other review keys replaceable. Verify: `.relevo/stacks/supabase.md` with `adapter` and `needs` keeps the plugin's values and lists both; `laravel` with `adapter` and `test: php artisan test --parallel` has the repository's `test` and the ignored declaration; a repository-only stack keeps all four keys; a test asserts that every stack with a plugin profile has an entry in the table of adapters.

## 2. The adapter is resolved from the profile

- [x] 2.1 Give `adapterFor` (`scripts/lib/review-adapters.mjs`) an optional `review` argument used only when the table has no entry, the target is empty and `adapter` is `api`; return `declared: true`, `log`, `test`, `driver` and `needs`. Update `NEXT_STEP` to say that a repository stack with no targets can declare an `api` adapter in its profile. Verify in `tests/review-adapters.test.mjs`: the five shipped combinations are unchanged and ignore a `review` argument, a declared stack is supported, a stack with a target stays unsupported, and the "No adapter" message has the new sentence.
- [x] 2.2 In `scripts/review-adapter.mjs`, resolve the profile with `resolveProfile` only for a stack without a table entry and pass its `review`; print its errors as the `reason` and exit 1, with the issue left `built`. Verify in `tests/review-declared.test.mjs` with a temporary `relevo.yml` and `.relevo/stacks/nhost.md`: exit 0 with `kind: api`, `declared: true`, log, test and needs; exit 1 naming the key for an invalid block; a shipped stack with a broken repository profile still exits 0.

## 3. Preflight, log and audit of a declared adapter

- [x] 3.1 Add the `--needs a,b` mode to `scripts/api-preflight.mjs` and `scripts/lib/api-preflight.mjs`: validate the names, find each in `PATH` without running it, run `docker info` when `docker` is listed, install and start nothing, read no file. Verify in `tests/api-preflight.test.mjs`: a missing tool exits 3 and names it, a stopped daemon exits 4, all present exits 0, a name with a path is refused, and the Laravel and Supabase modes still behave as before.
- [x] 3.2 Add the `compose` log to `scripts/lib/api-log.mjs` (`snapshotLog` records the services and the start time; `readSlice` runs `docker compose logs --no-color --since <start> <services>` from the folder of the platform and reports a failure as an unreadable source) and let `review-state.mjs init --log compose:...` use it. Verify in `tests/review-api.test.mjs` with an injected runner: the command is the one above, an entry from before the start is not read, and a failing runner gives an unreadable source whose verdict is `REVIEW INCONCLUSIVE` and cannot be waived.
- [x] 3.3 Add the `declared` flavor to `auditApi` (`scripts/lib/logaudit.mjs`): `FATAL`/`PANIC`, deadlock, out of memory, database `ERROR` that is not a denial, HTTP 500 or above; denials listed as expected while a run is recorded; the report says that errors without those signals are not detected. Record `declared: true` in the state and choose the flavor from it in `review-state.mjs`. Verify in `tests/review-api.test.mjs`: `FATAL` is rejected and waivable, `permission denied` with a run is listed as expected, a 500 is rejected, an empty slice with a run passes, an empty slice with no run is inconclusive, and an application error without those signals passes with the report saying so.
- [x] 3.4 Make the runs section of the pull request body say `test(s)` and `filter` for a declared adapter, and check that a run with `--tests 0`, or with no count, proves no line. Verify with state tests on `precheck` and `auto`.

## 4. The skill

- [x] 4.1 In `skills/review/SKILL.md`, add the declared adapter to the `api` steps: run `api-preflight.mjs --needs <needs>` from the folder of the platform and stop on exit 3 or 4 showing the hint; read the review block with `stack-profile.mjs --role review`; `init` with `--log "<review.log>"`; ask in one message for the written confirmation that the data is not production and that the local instance is up, and run `confirm-env` only after the yes; with `off` ask nothing and the person runs `review.test`. Verify in `tests/skill-review.test.mjs` that the skill names the generic preflight, the two questions, `confirm-env` and the `off` case.
- [x] 4.2 In the same file state the `{filter}` rule (one name that matches the safe pattern, otherwise the line stays for the person; no placeholder means the whole suite once at the end and every line for the person), that the agent never starts or stops the instance, never writes a test and never reads `.env`, and that `git status --porcelain` runs before and after each run. Verify in `tests/skill-review.test.mjs` that each of those sentences is present and that the Laravel and Supabase steps are unchanged.

## 5. Doctor

- [x] 5.1 In `scripts/lib/doctor.mjs`, resolve the declared adapter for a stack without a table entry, check each tool in `needs` on `PATH` and the Docker daemon, and warn naming `review.needs` and the tool. Verify in `tests/doctor.test.mjs`: a missing `nhost` warns with an install hint, a stopped Docker engine warns, everything present passes, and a repository without a declared adapter gets none of these checks.
- [x] 5.2 Report an invalid declaration as an invalid profile (missing `test`, remote `review.test`) and warn when a repository profile of a shipped stack sets `review.adapter` or `review.needs`. Verify with one doctor test per case.
- [x] 5.3 In the autopilot check, pass the declared adapter so it passes and no longer warns that a driven review is not available; add a note when `{filter}` is missing, and add no check for `review.autopilot` `off`. Verify with doctor tests for `precheck` with and without `{filter}` and for `off`.

## 6. Documentation

- [x] 6.1 Document the declaration in `docs/stacks.md` (after "Tuning how a stack is reviewed"): the keys, an example profile for a Compose backend, the local rule and what it cannot see, the confirmation, `{filter}`, the `compose:` log, what the audit flags and does not detect, and what cannot be declared (device, browser, a shipped stack). Verify with a test that the example parses with `parseProfile` and resolves with `adapterFor` to a declared `api` adapter.
- [x] 6.2 Write the same section in `docs/stacks.es.md`. Verify that it has the same headings, keys and example as the English one, and that the doc tests that compare both files pass.
- [x] 6.3 Run `npm test` and `openspec validate declared-review-adapter --strict`. Verify that both exit 0.

## Workflow follow-up

- Run the review on a temporary repository with a declared stack, a tiny local test command and a Compose file with one service, before archiving.
- Archive the change after the project's review requirements are satisfied; if `ios-review-adapter` is archived first, merge its text of "The review picks its adapter from the platform and the target" into this change's before archiving, then run `openspec validate --all`.
