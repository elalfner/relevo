# Design

## Context

See proposal.md for the motivation. What exists today:

- `review` resolves an adapter from `stack/target` in the table `ADAPTERS` of `scripts/lib/review-adapters.mjs`. There are three, `flutter/android` (device), `flutter/web` and `vue/web` (browser). A combination without one stops the preflight with `adapter.supported` false and a reason.
- The profile of `laravel` has `Targets: None`, so `targetOf` returns `null` and the key is `laravel/null`.
- The audit (`scripts/lib/logaudit.mjs`) reads a log, looks for error classes, and returns `REVIEW INCONCLUSIVE` when the log is empty or names no line of the app. A browser run keeps its own log (`evidence/web-log.txt`); a device keeps it by `drain` after each message.
- `review.autopilot` decides who drives. A browser has no manual way, so `needsAutopilot` is true for it. The agent never writes code in a review and never reads environment files; it starts servers only through `extra-server.mjs`.
- A repository may add `.relevo/stacks/<stack>.md`: its lists and body are added to the plugin's profile and it cannot remove an item or replace a command. A command is replaced only through `platforms.<name>.checks`. An unattended run cannot change that file.
- The profile of `laravel` already requires a feature test for each scenario, and says the tests must not point at a real database.

## Goals / Non-Goals

**Goals:**

- A Laravel-only repository can run `/relevo:review` with no configuration beyond what it already has, and reach the pull request.
- A repository that wants another way of reviewing says so in a file under version control, without changing the fixed rules of the review.

**Non-Goals:**

- Driving HTTP calls by the agent against a running server by default. That is opt-in through `serve`.
- A review for the stacks `supabase` or for a stack with no profile in the plugin. The new stop message tells them how to tune one; no adapter is added for them here.
- Executable review scripts supplied by the repository. A script is code that runs with the person's rights; this change adds none.
- A generic `review` block for Flutter and Vue. Their adapters keep their fixed behaviour.

## Decisions

**A new adapter kind `api`, picked by stack.** `ADAPTERS` gets `laravel/-` : `{ kind: 'api', log: 'storage/logs/laravel.log', capture: none, driver: 'php artisan test', needs: ['php', 'composer'] }`. `adapterFor` looks up `stack/target` first and falls back to `stack/-` for a stack without targets. Alternative: give Laravel a fake target such as `api`. Rejected: the profile says a backend has no targets, `platforms` validates targets against the stack, and a target nobody can run on would be a lie in `relevo.yml`.

**The person may review without autopilot.** `needsAutopilot` stays true only for a browser. With `off`, the person runs the project's tests in their own terminal and writes `ok` or `fail` per line; the agent observes, records, and audits. With `precheck` or `verify` the agent runs the tests. Alternative: require autopilot as the browser does. Rejected: a browser has no manual way, but running a test suite is something the person can do, and a default that needs a setting is the same trap the friend fell into.

**The agent proves a line with an existing test, never writes one.** For each checklist line it finds, by reading the tests, the feature test that covers the scenario, runs it with the base command plus `--filter` and records the test name and the exit code. `precheck` records it as the agent's result; `verify` may mark the line `ok (auto)` when the exit code proves the `THEN`, as it does for project commands today. A line with no test, or one that is only about wording or a shape the test does not assert, stays for the person. The run is a project command, so the rule "tracked files are unchanged afterwards" applies. Alternative: map scenarios to tests by a naming rule or a `{scenario}` placeholder in the header. Rejected: test names differ between teams, and a wrong mapping would mark a line proved by a test that checks something else.

**The log is a slice, not the file.** `review-state.mjs init` records, for each file the log setting names, its size (or that it does not exist yet). The audit reads from that offset. Nothing is truncated or deleted, because the log belongs to the person. The setting is a path or a glob, so a project on the `daily` driver (`laravel-<date>.log`) is covered; a file that appears after `init` is read from its start. Alternative: clear the log at the start, as `logcat -c` does. Rejected: it destroys the person's own entries and is a write outside the review.

**A recorded test run is the evidence of life for an `api` review.** The existing rule makes an empty log inconclusive, because on a device an empty log means the app was never exercised. A Laravel test run that passes writes nothing to the log, so the same rule would make every clean backend review inconclusive. For the `api` kind, the audit is `REVIEW INCONCLUSIVE` when no test run is recorded in the review state, whether the person told it (`ran <exit code>`) or the agent ran it, and the log is empty. When a run is recorded and the slice is empty, the verdict is `REVIEW PASSED`. A recorded run with a non-zero exit code is `REVIEW REJECTED` with the failing test names. The audit still looks, in the slice, for unhandled exceptions, `500` responses, SQL errors, deprecations that the project treats as errors, and lazy-loading violations. Alternative: always require lines in the log. Rejected for the reason above.

**The header of `.relevo/stacks/<stack>.md` carries a `review` block, and the plugin's profile carries the defaults.**

```yaml
review:
  log: storage/logs/*.log        # default of the laravel profile
  test: php artisan test         # the base command; the agent adds --filter
  serve:                         # optional; absent means tests only
    command: php artisan serve --port={port}
    url: http://localhost:{port}
    env:                         # a block map: the parser of the header takes no inline map
      APP_ENV: testing
```

The repository's values replace the plugin's defaults for this block. This is a deliberate exception to "a repository cannot replace a command" in `platforms`: those commands are the gates (`analyze`, `test`, `format`) and `checks` stays the only way to replace one; the `review` block says how the review is driven, and every gate of the review (the person confirms each line, the audit, `decide`) lies outside it. The resolved profile lists each replaced key so `doctor` and the output of the profile command show it. The body gets a section `Review`, joined after the plugin's, that is read by the agent only in a review.

Alternative: `platforms.<name>.review` in `relevo.yml`. Rejected: it is per platform, and the way a stack is reviewed is a stack habit; it also grows into configuration. Alternative: a script the repository supplies. Rejected for this change (Non-Goals). A third place, a separate `.relevo/review/<stack>.md`, was dropped to keep one file per stack.

**`serve` reuses `extra-server.mjs`.** The agent asks for a free localhost port, substitutes `{port}`, starts the command through the script, waits until the URL answers, and stops only what it started. The variables of `env` are names and values the repository wrote; the real environment files are never read. The person confirms that the data is not production (`confirm-env`) before any server starts, and that confirmation names the database the project's test configuration points to. The origin of the calls is `localhost` and the port: `review.allowed_origins` is not used for an `api` review.

**Fixed rules cannot be loosened by the file.** The `Review` section and the header may add steps and may ask for more evidence. A line that tells the agent to skip the audit, to mark lines without proof, to read an environment file, to suggest a waiver, or to open the pull request is ignored, and `doctor` warns when it finds one of a fixed list of phrases. This is stated in the skill, in the profile merge and in the spec, and it is the same shape as "adds, never weakens" for the profile.

**A preflight before the review, like the one of the browser.** `scripts/api-preflight.mjs` checks, without reading `.env`, that `php` and `composer` are on the path, that `vendor/` exists and matches `composer.lock`, and what database `phpunit.xml` and `phpunit.xml.dist` declare (the `DB_CONNECTION` and `DB_DATABASE` of their `env` entries). `sqlite` with `:memory:` is safe; anything else is reported by name and needs the person's `confirm-env` first, and a connection that is not `sqlite` is a warning that the build must provide it. It prints JSON and exits by what is missing, so the skill can tell the person in their language. It installs nothing; when `vendor/` is missing it names the Composer command for the person to run, as the Vue review does for its dependencies.

**A clear stop for an unsupported stack.** The message of `adapterFor` says that the stack has no review adapter, which adapters exist, that the work stays `built`, and that the repository can tune a stack it ships through the `review` block, or open the pull request by hand after reading the diff. It does not promise that a hand-opened pull request skips the labels; it says what `ship` expects.

## Risks / Trade-offs

- [A test run recorded by the person's word cannot be checked] → The person's `ran` line is recorded as theirs, the PR body shows which lines were proved by the agent and which by the person, and the audit of the log slice still runs.
- [A test with a name that matches several tests with `--filter`] → The agent records the filter it used and the count of tests that ran; a count of zero is a failed proof, not a pass.
- [The test database is a real one] → The preflight reads the database declaration of `phpunit.xml`, never the real environment file, and refuses to run tests until `confirm-env` when it is not in-memory SQLite. A project whose `phpunit.xml` does not declare a database is reported as unknown, which needs the same confirmation.
- [`serve` runs a command written in a file] → It is a file under version control that an unattended run cannot change, the same trust as `checks`; the command is never taken from an issue or a comment, and it runs through the script that records and stops it.
- [A `daily` log grows during the review and a file rolls over at midnight] → Offsets are per file; a new file is read from its start. A review that crosses midnight is covered, and a file that was rotated away is reported in the audit as unreadable instead of being skipped silently.
- [The `review` block replaces defaults and someone points `log` at a file the project does not write] → The audit says the slice came from a file that does not exist and returns `REVIEW INCONCLUSIVE` unless a test run is recorded; `doctor` warns when the path matches nothing in the repository and `storage/logs` is absent.
- [Two Laravel platforms in one repository share one `.relevo/stacks/laravel.md`] → They share the review block. A platform that needs another test command uses `platforms.<name>.checks.test` for the build and accepts the same review command; separating them is not worth the weight of a second file.

## Migration Plan

Additive. A repository with no `review` block gets the defaults; a repository with Flutter or Vue sees nothing change. Rolling back means removing the `laravel/-` entry and the new stop message; the review state gains optional fields (`log_offsets`, `runs`) that older versions ignore.

## Open Questions

- Whether `doctor` should count a hand-opened pull request, for a stack with no adapter, as a state that `status` shows. It does not change the specs here and can be answered after the first use.
