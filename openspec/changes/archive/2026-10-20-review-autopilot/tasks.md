# Tasks

## 1. Settings and adapters

- [x] 1.1 Add `review.autopilot` (`off`|`precheck`|`verify`, default `off`) and `review.allowed_origins` (list of origins, default empty) to `scripts/lib/config.mjs` and `templates/relevo.yml`. Verify with additions to `tests/config.test.mjs` and `tests/template.test.mjs`: the defaults, an invalid value naming `review.autopilot` and the allowed values, origins read as a list, an entry that is not an origin rejected.
- [x] 1.2 Add `scripts/lib/review-adapters.mjs` and `scripts/review-adapter.mjs` (`--platform`, optional `--target`, exit 1 when not supported). Verify with `tests/review-adapters.test.mjs`: each row of the table, an unknown stack, iOS saying it is not available yet, a platform with several targets, the script against a temporary `relevo.yml`.

## 2. State per line

- [x] 2.1 Extend `scripts/lib/review-state.mjs`, `scripts/review-state.mjs` and `scripts/lib/checklist.mjs` with the mode, `precheck`, `auto`, `confirm-env`, `auto-list` and the markdown of automatic lines. Verify with `tests/review-autopilot.test.mjs` through the script: precheck leaves the line pending, `auto` only in `verify` and with a reason, nothing before `confirm-env`, a person's `fail` or `retest` clearing both marks, `decide` still needing the person's agreement, the section for the pull request body, a state saved before the change still working as `off`.

## 3. The browser

- [x] 3.1 Add `scripts/lib/web-review.mjs` with `isAllowedOrigin`, `scanReviewScript`, `redact` and `formatBrowserLog`, and the browser patterns in `scripts/lib/logaudit.mjs`. Verify with `tests/web-review.test.mjs`: allowed and blocked origins (localhost with any port, a listed origin, a look-alike host, a data URL), the script scan on each forbidden construct and on a clean script, redaction of several values, the log format being read by `filterByApp` and `auditLog` with the package `web`, an uncaught exception and a failed request becoming findings, an empty browser log being inconclusive.
- [x] 3.2 Add `scripts/web-review.mjs`. Verify with `tests/web-review-run.test.mjs` against a local HTTP server and the real Chromium of this environment (skipped when Playwright cannot be resolved): a page with a passing assertion gives `auto-ok`, a failing one `auto-fail`, a request to another origin is blocked and recorded, a script that imports `node:fs` is refused before a browser starts, a secret that the page echoes is redacted in the files, the log file is judged by the audit, the exit codes.

## 4. The skill, the agent and doctor

- [x] 4.1 Update `skills/review/SKILL.md` (the adapter in the preflight, the modes, the rewritten rule about operating the app, the non-production confirmation, the Flutter driver sequence and rules, the web flow with `qa` reviewing the script before `web-review.mjs`, the automatic lines in the pull request body), `agents/qa.md` (the script review) and `stacks/flutter.md` (the adapters). Verify with additions to `tests/skill-review.test.mjs` and `tests/agents.test.mjs`: each scenario of the `review` delta has its sentence, every script named exists and its flags are implemented, the origin confirmation comes before any driven step, `qa` comes before the runner, `off` keeps the old rule, and no forbidden tool (`adb shell input`, Appium, Maestro, coordinates) appears except in a sentence that forbids it.
- [x] 4.2 Add the autopilot checks to `scripts/lib/doctor.mjs` and `scripts/doctor.mjs` facts. Verify with additions to `tests/doctor.test.mjs`: the three scenarios of the `init-doctor` delta, and a repository with `off` getting no new check.

## 5. Documentation and integration

- [x] 5.1 Update `docs/commands.md`, `docs/commands.es.md`, `docs/configuration.md`, `docs/configuration.es.md` and `CHANGELOG.md` (including that the default is `off` and why). Verify with `tests/readme-sync.test.mjs` and the changelog test.
- [x] 5.2 Run `node --test tests/*.test.mjs` and `openspec validate --all`; both must pass.
- [x] 5.3 Try the browser for real: write a small page and a Playwright script as the agent would, run `web-review.mjs`, and read the result and the audit. Record what happened, and what could not be tried (the Flutter driver, a device, `verify` on a real app, iOS), in `docs/pilot-findings.md`.
