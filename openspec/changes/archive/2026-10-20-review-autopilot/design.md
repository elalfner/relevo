## Context

See `proposal.md`. Facts that shape the design:

- The skills are prose; rules that must not vary live in scripts with tests. The new rules (the origin guard, the script scan, the redaction, who may mark a line automatic) are such rules.
- `review-state.mjs` already keeps the checklist, the audit and the agreement on disk, and `decidePr` is the single rule for opening the pull request.
- The audit works on logcat-format text and filters by a process id found in a `Start proc` line. A browser log written in that format can reuse the same code with the pseudo-package `web`.
- Playwright is not a dependency of the plugin (the plugin has none); the runner resolves it from the project being reviewed.
- Where the plugin is developed there is a Chromium and Playwright, but no Flutter, no `adb` and no device. What needs them can only be covered by tests of the text of the skill and cannot be tried.

## Goals / Non-Goals

**Goals:** a review that can start for a web target; an agent that can help without taking the decision; limits on what a driven review can reach, enforced by a script; a log from a browser that the audit can judge.

**Non-Goals:** reviewing a backend; an iOS review beyond saying it is for macOS; video; trying the Flutter driver or the `verify` mode on a real app; making `precheck` the default (see D1).

## Decisions

**D1. `off` is the default, not `precheck`.** The earlier plan set `precheck` as the default. Nothing here has run against a real app, a real device or a real MCP server, and the mode changes a rule that was "the agent never operates the app". A default has to be something proven; `off` keeps today's behaviour for everyone, and a repository opts in. The default can move to `precheck` in a later change once the first real reviews show it works.

**D2. Adapters are a table.** `scripts/lib/review-adapters.mjs` exports `adapterFor({ stack, target })` returning `{ supported, kind, log, capture, driver, needs, reason }`: `flutter/android` → device, `adb logcat`, `adb screencap`, driver `flutter_driver`, needs `adb`; `flutter/ios` → simulator, `xcrun simctl`, needs macOS and `xcrun`, `supported: false` with reason "the review of iOS is not available yet" (nothing here can run it); `flutter/web` and `vue/web` → browser, log by the runner, capture by the runner, driver `flutter_driver` or `playwright`, needs a browser; any other → `supported: false`. `scripts/review-adapter.mjs --platform <name>` resolves the platform and target of the issue from `relevo.yml` and prints the adapter as JSON, exit 1 when not supported. A platform with several targets uses the first target unless `--target` is given.

**D3. State per line.** `review-state.mjs` stores `autopilot` (the mode at `init`) and, for each item, `precheck` (`ok`, `fail` or null) and `auto` (null or a string saying how it was verified). New commands: `precheck <n> ok|fail [note]` (allowed when the mode is `precheck` or `verify`) and `auto <n> <how...>` (allowed only in `verify`, requires a non-empty `how`, sets `status: ok` and `auto`). A person's `fail` or `retest` clears `auto` and `precheck`. `decidePr` is unchanged in what it requires (every line `ok`, the audit passed, the person agreed); what changes is that a line may be `ok` because of `auto`. `checklistMarkdown` shows `(verified automatically: how)` after such a line, and `review-state.mjs auto-list` prints the section "Verified automatically" for the pull request body. `init` takes `--autopilot <mode>`; a state saved before has none and behaves as `off`.

**D4. The web runner.** `scripts/web-review.mjs --script <file> --url <url> [--allow-origins a,b] [--secret-env A,B] [--out evidence] [--headed]` does, in this order: reads the script and refuses it if `scanReviewScript` finds a problem; resolves Playwright from the project (`createRequire(cwd)`, then the plugin's own resolution); launches Chromium, a new context (no persistent profile); installs a route handler that aborts every request whose origin is not allowed (`localhost`, `127.0.0.1`, the origin of `--url` and `--allow-origins`) and records it; collects console messages of type error, page errors and failed requests; runs the default export of the script with `{ page, baseUrl, line }`, where `line(n, how, fn)` runs `fn` and records `auto-ok` with `how` or `auto-fail` with the message; writes `evidence/web-log.txt` in logcat format and `evidence/web-result.json`; prints one line per checked line. Exit 0 when it ran (results can still be failures), 1 when the script was refused or the browser could not start, 2 for bad arguments. Playwright's own timeouts bound each step; the whole run has a limit of 120 seconds.

**D5. The script scan is a tripwire, not a sandbox.** `scanReviewScript(text)` returns problems for any `import` or `require` other than `node:assert`, `node:assert/strict` and `playwright`/`@playwright/test`, and for `eval`, `new Function`, `child_process`, `process.exit`, `process.env` (the secrets are passed as `credentials`, a function of names, so the script never touches `process.env`), `fetch(`, `XMLHttpRequest` outside `page.evaluate` is not distinguishable so `page.evaluate` is left to `qa`. It exists to catch an agent that strays; the protection that matters is that `qa` reads the script first and the origin guard blocks the network of the browser. The skill says so, and does not call it a sandbox.

**D6. Secrets by name.** `--secret-env USER_NAME,USER_PASS` makes the runner read those environment variables and expose `credentials(name)` to the script (returns the value, or throws if unset). Every value is replaced by `[redacted:NAME]` in the log, the result file and the console output before they are written. The agent is told only the names.

**D7. The browser log is in logcat format.** `formatBrowserLog(events, { origin })` writes a `Start proc 1:web/<origin> for page` line, then `MM-DD HH:MM:SS.mmm  1  1 E web : <text>` for each error event (console error, page error, request failed, request blocked), `I web :` for the rest is omitted. The audit is run with `--package web`. `logaudit.mjs` gains the browser patterns: `Uncaught`, `ReferenceError`, `SyntaxError`, `Unhandled (promise )?rejection` as `exception`, and `requestfailed` and `blocked request` as `network-data` (for the blocked origin the finding is also useful evidence). An empty log is already inconclusive.

**D8. Flutter through the MCP tools.** The skill describes the sequence (`launch_app`, `connect_dart_tooling_daemon`, `flutter_driver` commands, `get_runtime_errors`, `get_app_logs`, `hot_reload` after a micro-fix) and the rules of the proposal. Nothing here can run it, so tests check the text, and the findings page says it was not tried. The MCP log is the source of the audit for that adapter: if it does not answer or returns nothing, the audit is inconclusive, which the existing rule already gives.

**D9. Non-production confirmation.** Before the first driven step the skill asks, and `review-state.mjs confirm-env` records `envConfirmed: true`; `precheck` and `auto` are refused until it is recorded. The agent cannot know where the app points, so the person says it.

**D10. `qa` reviews the script.** `agents/qa.md` gains a section: given a review script, read-only, check that every `line(...)` has an assertion that would fail if the behaviour did not exist (not only that the page loads), that nothing outside the allowed origins is visited, that no credential value is written, and that lines about appearance are not asserted. It rejects with the line number. The skill launches `qa` on the script before `web-review.mjs`.

**D11. Doctor.** With `review.autopilot` not `off`, `doctor` checks `lib/main_driver.dart` and the `flutter_driver` dependency in `pubspec.yaml` of each Flutter platform, and Playwright resolution for each Vue platform; warnings with the fix, never failures.

## Risks / Trade-offs

- An agent-written script runs on the person's machine. The layers are: `qa` reads it, the scan refuses the obvious, the browser cannot reach other origins, the profile is clean. None is a sandbox; the skill and the docs say the person should read a script that will touch anything sensitive, and the credentials are names.
- `verify` can mark a line that an assertion proved but that does not match what the person would see. That is why the pull request lists the automatic lines and the person always agrees; `precheck` is the milder mode.
- The Flutter driver rules come from another project's experience and are untried here.
