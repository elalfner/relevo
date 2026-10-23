# Tasks

## 1. Review state

- [x] 1.1 Export the gate of `scripts/lib/review-state.mjs` as `assertDriving(state)`, refusing also when `agreed` is true for the runner (a separate flag so `precheck` and `auto` keep their behaviour); verify with `tests/review-autopilot.test.mjs` unchanged and passing plus a case for the agreed state
- [x] 1.2 `review-state.mjs capture` refuses after `agree`; verify with a test that the state's captures are unchanged and the message says the review is agreed
- [x] 1.3 `review-state.mjs qa-pass <script>` stores `{ path, sha256 }`; `sync` clears it; verify with tests for both

## 2. Gates in the runner

- [x] 2.1 `web-review.mjs --state <file>`: before the scan and before Playwright, exit 1 with the reason when the state is missing, `autopilot` is `off`, `envConfirmed` is false, `agreed` is true, or the script's sha256 differs from `qaScript`; verify with tests in `tests/web-review-run.test.mjs` that each case exits 1 and writes no `web-log.txt`
- [x] 2.2 A state fixture (`autopilot: precheck`, `envConfirmed: true`, `qaScript` of the test's script) for every existing run test; verify `node --test tests/web-review-run.test.mjs` passes
- [x] 2.3 A test that changes one character of a passed script and gets exit 1 naming `qa-pass`

## 3. Script check and console

- [x] 3.1 New `FORBIDDEN` rules: `.screenshot(` (message names `capture(name, check)`), `.pdf(`, `tracing`, `recordVideo`, `recordHar`, `routeFromHAR`, `.saveAs(`, `.storageState(`, `.setInputFiles(`, any `path:` key; verify with `tests/web-review.test.mjs` cases for each, `page.screenshot({ path: 'evidence/x.png', fullPage: true })`, `page.screenshot()` without a path, and one showing `await capture('01_initial', async () => assert.ok(true))` passes
- [x] 3.2 The runner takes over the console before it loads the script, keeps it until the process ends (so a script still running after a timeout cannot print) and writes it redacted to `<out>/script-console.txt`; verify with a run test where the script logs a secret and a marker: stdout holds neither, the file holds the marker and `[redacted:NAME]`

## 4. Captures

- [x] 4.1 `makeCapture({ page, out, captures })` in `scripts/lib/web-review.mjs`: `safeCaptureName`, `check` required, only `{ fullPage }`, check before the screenshot, returns `undefined`, a failed check records `ok: false` and does not throw; verify with unit tests on a fake page: `../../x` and `a/b` refused without calling the page, a missing `check` refused, an unknown option refused, a failing check takes no screenshot, a good capture writes `<out>/<name>.png`
- [x] 4.2 Pass `capture` to the script; print `captured <path>` or `capture <name>: failed (<message>)`; list captures in `web-result.json`; re-read the state and append saved paths; verify with a run test that the PNG exists under `--out`, the state lists it, a capture whose check fails writes nothing, and stdout holds no base64 and no PNG signature
- [x] 4.3 Update the header comment of `web-review.mjs` (usage, `--state`, `capture`, `script-console.txt`) and the `capture` text of `vue/web` in `scripts/lib/review-adapters.mjs`; verify with `tests/review-adapters.test.mjs`

## 5. Diagnosis and several runs

- [x] 5.1 When the script fails outside a line, print the first `pageerror` or same-origin `response` event as `the page itself failed: ...` before the script error; verify with a run test where `/app.js` answers 500 and the script waits for a missing element
- [x] 5.2 Warn on stderr when `--out` is not given and `evidence/web-log.txt` already exists; verify with a run test
- [x] 5.3 Verify with a run test that two runs with `--out a` and `--out b` and one `--state` keep two logs and results, and the state holds the captures of both

## 6. Preflight

- [x] 6.1 `scripts/lib/web-preflight.mjs` and `scripts/web-preflight.mjs --url <url> [--timeout ms] [--wait ms]`: `node_modules`, Playwright, Chromium executable, the URL and its same-origin module scripts below 400 after redirects; JSON `{ ok, check, detail, start, env }`; exits 0, 3, 4, 5, 6, and 2 for bad usage; verify with `tests/web-preflight.test.mjs` using injected file system, resolver and fetch, including a module that answers 500, `--wait` passing on the third try, and `.env` never read
- [x] 6.2 Change the hint of `web-review.mjs` when Playwright is missing to `npm install --no-save playwright` and `npx playwright install chromium`; verify with a test on the message

## 7. Extra servers and the step 9 guard

- [x] 7.1 `scripts/lib/extra-server.mjs` and `scripts/extra-server.mjs start|check|stop`: busy port refused, `--unset` refused when `.env` or `.env.*` other than `.env.example` exists (existence only), detached process group, log in `evidence/servers/<port>.log`, record in `evidence/servers.json`, `check` confirms the listener belongs to the recorded group, `stop --port|--all` kills only recorded groups, no `lsof` refuses to start; verify with `tests/extra-server.test.mjs` using an injected spawner and port probe, including a stop on an unrecorded port that kills nothing
- [x] 7.2 `scripts/dev-server-guard.mjs --url <url>`: exit 0, 1 or 3 as in the design; verify with `tests/dev-server-guard.test.mjs` using an injected `lsof` runner: a listener in the repository, one outside, none, and `lsof` missing

## 8. Advice and brief

- [x] 8.1 `review-adapter.mjs` adds `advice` (`en`, `es`) when `needs_autopilot` and `review.autopilot` is `off`, else `null`; verify with `tests/review-adapters.test.mjs` for both languages and for `precheck`
- [x] 8.2 `review-brief.mjs --autopilot <mode>` appends the fixed note in `precheck` and `verify`, nothing in `off`; verify with `tests/review-brief.test.mjs` in both languages

## 9. Skill

- [x] 9.1 Step 0: show the adapter's `advice`; warn on an uncommitted `relevo.yml` and say it belongs on the base branch
- [x] 9.2 Step 2 browser branch: no `adb`, `confirm-env`, `web-preflight.mjs` and the handling of each exit code (install with permission and restore `package-lock.json`; start command and wait)
- [x] 9.3 Step 3: `--autopilot` on the brief, the plan of the walk in the fixed format, the extra configurations before `confirm-env`, and the shot list with the assertion of each shot
- [x] 9.4 Step 4 and Autopilot: captures during the walk, never after `agree`; the script with `capture(name, check)`; the QA instructions (names on the shot list, assertions that tell shots apart, no screenshot otherwise); `qa-pass` after `QA PASSED` and a new QA pass after any edit; `extra-server.mjs` with `npx vite --port <p> --strictPort`, readiness with `web-preflight.mjs --wait`, `check`, one `--out evidence/run-<port>` per run, `stop`; lines needing an unset variable when env files exist stay for the person; project commands with `git status --porcelain` before and after, restore and report, no fix or format scripts; `read` lines are `precheck` only; a request for screenshots after the agreement points to the existing files
- [x] 9.5 Step 5: a browser review audits only `evidence/web-log.txt` with `--package web`
- [x] 9.6 Step 8: list only `evidence/**/*.png` for `attach_to_pr`; with none, delete the folder without asking
- [x] 9.7 Step 9: `extra-server.mjs stop --all`, then `dev-server-guard.mjs`; switch only on exit 0, otherwise stay and say why
- [x] 9.8 Pin the new rules in `tests/skill-review.test.mjs` (preflight before the first run, `capture(` with a check, `qa-pass`, `--out evidence/run-`, audit of the normal log only, `--no-save`, no `.env` read, the guard before `git switch`, PNG-only hand-off); verify with `node --test tests/skill-review.test.mjs`

## 10. Documentation

- [x] 10.1 `docs/commands.md`, `docs/security.md`, `docs/configuration.md` and their `.es.md` versions: captures and their assertions, the gates of the runner, the refused calls, the preflight, extra servers, the step 9 guard, the advice for `review.autopilot` and committing `relevo.yml` to the base branch
- [x] 10.2 Changelog under Unreleased

## 11. Check

- [ ] 11.1 `npm test` and `openspec validate --all` pass; then one browser review of a Vue issue with `review.autopilot: precheck` on a sandbox repository with a dev server running from the working tree, recording in `design.md`: the shot list taken during the walk with checks, one capture with a wrong check that failed, an extra server run in its own folder and stopped, only the normal log audited, only PNGs offered, and no branch switch under the running server

## Workflow follow-up

- Open the pull request from a branch made from `dev` to `dev`, without attribution lines.
- Archive the change after the pull request is merged.
