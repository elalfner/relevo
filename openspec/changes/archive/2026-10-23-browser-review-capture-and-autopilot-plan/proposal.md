# Proposal

## Why

Two browser reviews of Vue issues (`review.autopilot: precheck`) worked, but the agent had to improvise. The browser runner cannot take a screenshot although the adapter says it does, so the agent called `page.screenshot` with a free path, which the script check accepted. A screenshot is not tied to an assertion, so one saved under the wrong name passes unnoticed, and nobody but the person can tell, because the agent never opens images. Captures were recorded after the agreement and the pull request. Step 9 switched branches while the person's dev server ran from the working tree, and broke it. A failing page was reported as a selector timeout. Servers with another configuration were started, awaited and stopped by hand, relying on there being no `.env` file. A script edited after QA ran again only because the agent chose to ask QA again. The runner also trusts the skill for its gates, lets the script print to the agent unredacted, and lets it write files through Playwright.

## What Changes

- `web-review.mjs` reads the review state (`--state`, default `evidence/review-state.json`) and refuses before any browser starts when there is no state, `review.autopilot` is `off`, the data was not confirmed, the review was already agreed, or the script is not the one QA passed (its hash differs from the one recorded by `review-state.mjs qa-pass`).
- The review script gets `capture(name, check, { fullPage })`: `check` is an assertion of the state the shot shows and runs right before it; a failing check takes no screenshot and is reported. The file is `<out>/<name>.png`, nothing is returned to the script, the runner prints only paths and records them in the state.
- `review-state.mjs capture` is refused after `agree`; the shot list is taken during the walk.
- The script check refuses every direct screenshot and every Playwright call that saves or uploads a file, and any `path:` option. The script's console goes, redacted, to a file instead of the runner's output.
- When the script fails outside a line, the runner names the page's own failure (an uncaught error, or a same-origin response of 400 or more) as the probable cause before the script error.
- One `--out` per run, one shared state, a warning before the default log is replaced, and the audit reads only the log of the normal run.
- `web-preflight.mjs --url [--wait ms]` checks dependencies, Playwright and its browser, the page and its module scripts; with `--wait` it is the readiness probe of extra servers. Playwright is installed only with permission, with `--no-save`, and the lock file is restored.
- `extra-server.mjs start|stop` starts a dev server on a free localhost port with `--strictPort` and a given set and unset of variables, records its PID, and stops only PIDs it recorded. When an env file the dev server loads by itself exists, a line that needs a missing variable is not run this way.
- Step 9 does not switch branches while the server under review runs from the working tree; it says why.
- Step 0 warns when `relevo.yml` has uncommitted changes and says they belong on the base branch; the browser stop message recommends `verify` (`precheck` as the cautious option) in the language of `relevo.yml`.
- The brief proposes up front which lines the agent walks and how (browser, command, read, server), with a fixed note that the person confirms every line and that appearance is never marked automatically.
- Evidence hand-off lists only the PNG files, in every run folder; with none, the folder is deleted without asking.
- Unchanged: the agent never opens screenshots, never drives the person's browser, reaches only localhost, the address under review and `review.allowed_origins`; the person confirms every line and agrees to the pull request; no waiver is suggested; the pull request body has no images.
- Out of scope: Flutter on the web, the device path, marking lines from the runner, a temporary worktree for extra servers.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review`: captures through the runner tied to an assertion and taken before the agreement; the runner enforces autopilot, data, agreement and QA gates; the script cannot screenshot, read or write files or print to the agent; the page's own failure is reported as such; separate evidence per run with only the normal log audited; preflight and readiness checks; extra servers owned by a script; no branch switch under a running server; a warning for an uncommitted `relevo.yml`; the browser stop advice; the brief's walk plan; image-only evidence hand-off; a project command's exit code can verify a line and reading code only pre-checks it.

## Impact

- Scripts: `web-review.mjs`, `lib/web-review.mjs`, `review-state.mjs` and its lib (`assertDriving`, `qa-pass`, capture after `agree`), new `web-preflight.mjs` and `extra-server.mjs` with their libs, a new `dev-server-guard.mjs` for step 9, `review-adapter.mjs` (advice), `review-brief.mjs` (note).
- `skills/review/SKILL.md` (steps 0, 2, 3, 4, 5, 8, 9 and Autopilot), docs `commands`, `security`, `configuration` and their Spanish versions, the changelog.
- Tests: `web-review`, `web-review-run` (state fixture everywhere), `review-autopilot`, `review-adapters`, `review-brief`, `skill-review`, new `web-preflight`, `extra-server` and `dev-server-guard` tests.
- Browser review scripts that call `page.screenshot` or `console.log`, or that change after QA, are now refused.
