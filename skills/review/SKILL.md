---
name: review
description: Guides the review of a built issue on the platform it was built for. By default the person drives the app on a device and you only observe: you save screenshots on request and audit the log when they say they are done. When review.autopilot is precheck or verify, you may also walk the checklist through semantic finders or a browser of its own, within fixed limits, and the person still confirms and agrees. When everything is verified and they agree, it opens the pull request. Use only when asked to run review for an issue number. It needs a connected device, a browser, or (for a backend such as Laravel) the project's tests, so it runs on a person's machine.
argument-hint: "[issue-number]"
disable-model-invocation: true
---

# Relevo review

Review the built issue `$ARGUMENTS` with a person who uses the app on a real device. You are the observer: you capture screens when asked and you audit the log at the end. The person tests; you never do.

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`. Run them with `node`. They hold the rules that must not vary (checklist, log audit, when a pull request may open, which names are safe); use them instead of judging those things yourself.

## What you must never do

- Never tap, swipe, type or press keys on the device: no `adb shell input`, no monkey, no UI-automation tool, no Flutter driver. The person does everything in the app, unless `review.autopilot` is `precheck` or `verify`: then only what the Autopilot section allows, and never by coordinates, never with `adb shell input`, Appium or Maestro, never in the person's own browser and never on a third-party site.
- Never send a message, make a call or press a send button in any other app. If a step needs it (for example sending something through a messaging app), the person does it.
- Never open the screenshots. They can show real customer data. They are saved to disk and nothing else.
- Never patch code during the review. A defect found here goes through `/relevo:fix`.
- Never waive a finding, and never suggest or hint that one could be waived: a waiver is the person's decision, written by them as `waive <number> <reason>`.
- Never commit the `evidence/` folder, and never force-push.
- Never read the project's environment files (`.env`, `.env.local` and the like); only `.env.example` and the specification give variable names. Never stop, restart or signal a server you did not start with `extra-server.mjs`, above all the one the person started.

The only `adb` commands you may run are: list devices, clear or read the log (`logcat`), and the screenshot taken by `capture.mjs`.

In an `api` review (a backend with no screen) there is no `adb`, no device and no capture. You never write or edit a test, never change the database by hand, never quote the log of the app beyond the findings the audit prints, and never take a command for a server from anywhere but the `serve` block of the profile (see the section on the `api` adapter in Autopilot).

## Steps

### 0. Preflight

Stop with a clear message, changing nothing, if any of these fails:

- `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-config.mjs relevo.yml` exits non-zero. Show its output.
- `git check-ignore -q evidence/` fails: the evidence folder is not ignored by git. Tell the person to add `evidence/` to `.gitignore`.
- The issue is not `built` (or `in-review`, to resume). Say which state it is in and what to do (`/relevo:go`, `/relevo:fix`).
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-adapter.mjs --platform <platform>` (the platform of the issue, from `platform-of.mjs`) exits 1: no review is possible for that platform and target; show the `reason` and stop, changing nothing. If it prints `needs_autopilot: true` and `review.autopilot` is `off`, stop and show its `advice` as it is: it recommends `verify`, names `precheck` as the cautious option, and is already in the language of `relevo.yml`.
- Not a stop, a warning: if `git status --porcelain -- relevo.yml` prints anything, tell the person that `relevo.yml` has uncommitted changes, that this review uses them as they are, and that they belong on the base branch through a commit of their own. Never stage or commit `relevo.yml` in this review.
- For an adapter whose kind is `device`: `node ${CLAUDE_PLUGIN_ROOT}/scripts/device.mjs` exits non-zero. Show its message: it says what to connect or authorise. Keep the serial it prints as `<serial>`. A `browser` or an `api` adapter needs no device.
- For an adapter whose kind is `api`: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/api-preflight.mjs` from the folder of the platform. Exit `3` (PHP or Composer is missing), `4` (no `vendor/`) or `5` (`vendor/` does not match `composer.lock`): show its `detail`, give the `install` command for the person to run, install nothing yourself, and stop. Exit `6` is not a stop: the test database is not in-memory SQLite, or is not declared (its `detail` names it); say so and ask the person to confirm in writing that it is not production before any test or server runs (a test the person runs themselves in `off` is theirs, and the confirmation is asked when you will run something). Exit `0` is ready.

Find the repository (`$GITHUB_REPOSITORY`, or `gh repo view --json nameWithOwner -q .nameWithOwner`), the issue's branch (`git branch -r --list "origin/feature/$ARGUMENTS-*"`) and its change folder: the one `openspec list --json` names that starts with `$ARGUMENTS-` (`openspec/changes/<name>`).

Check who is running the review. The assignee is the person who should test on the device:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/review-who.mjs --assignee <the issue's assignee, from gh issue view $ARGUMENTS --json assignees> --login <gh api user --jq .login>
```

If it exits 1 it names both people: ask the person for a written confirmation that they are reviewing it themselves, and stop if they do not give it.

### 1. Synchronise with the base branch

The person must never review a stale base.

```bash
git fetch origin <base> <branch>
git switch <branch>
git pull --ff-only origin <branch>
git merge --no-edit origin/<base>
```

The pull brings in what `go` or `fix` pushed from another machine, so the person tests the current code. If it cannot fast-forward, the local and the remote branch have diverged: leave the issue as `built`, say so, and stop (never rebase, reset or force anything).

If the merge conflicts, run `git merge --abort`, leave the issue as `built`, tell the person which files conflict, and stop.

If the merge brought in changes, find the platform of the issue again and resolve its profile and QA skills:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/platform-of.mjs --issue $ARGUMENTS
node ${CLAUDE_PLUGIN_ROOT}/scripts/stack-profile.mjs --platform <platform>
node ${CLAUDE_PLUGIN_ROOT}/scripts/role-skills.mjs --role qa --platform <platform>
```

If `platform-of.mjs` exits 1, stop and tell the person what it printed (they correct the `Platform:` line); the issue stays `built`. Otherwise launch the `relevo:qa` agent again on the result (same change folder, rules files `qa.rules_from`, base branch, and now the profile, the folder of the platform and the skill paths). If it rejects, stop and tell the person to run `/relevo:fix $ARGUMENTS`; the issue stays `built`.

When the synchronisation succeeded, claim the issue: `node ${CLAUDE_PLUGIN_ROOT}/scripts/label-change.mjs --to in-review --current "<current labels>"`, applied with `gh issue edit`.

### 2. Start, or resume

If `evidence/review-state.json` exists for this issue, resume: show the confirmed lines and captures it already holds, and continue at step 4. If a fix changed the specification since the state was saved, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs sync openspec/changes/<change folder>` first: confirmed lines stay, failed lines and new scenarios are pending.

Otherwise: `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs init openspec/changes/<change folder> --autopilot <review.autopilot>`, then clear the log so the audit only sees this session: `adb -s <serial> logcat -c`. Then ask the person to start the app, or restart it if it was already open, so that the log names its process and the audit can ignore other apps on the device.

For an `api` adapter, first read the profile of the platform for a review, `node ${CLAUDE_PLUGIN_ROOT}/scripts/stack-profile.mjs --platform <platform> --role review`: it prints the `review` block (`log`, `test`, and `serve` when the repository set one), the keys the repository replaced, the `notes` (the section Review of the profile) and `warnings`. Show the replaced keys and any warning to the person; a warning is a line that asked for what a review never changes, and you ignore that line. Then `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs init openspec/changes/<change folder> --autopilot <review.autopilot> --adapter api --log "<review.log>" --cwd <the folder of the platform>` instead of the command above. It records how much of each log file exists now, and the audit reads only what they receive after this point; no log is cleared, truncated or deleted, and you never run `logcat`. There is nothing to start: go to step 3.

For a `browser` adapter there is no `adb` and no device log: after `init`, run the preflight from the folder of the platform, against the address under review (the one the person gives; for Vue, `http://localhost:5173` when they give none):

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/web-preflight.mjs --url <address>
```

It prints JSON and exits by what is missing. Tell the person in their language:

- `3` (there is no `node_modules`) or `7` (the installed dependencies do not match `package-lock.json`, for example after the merge changed it): when `install` is `null` there is no lock file to install from; ask the person to install the dependencies themselves and stop until they say it is done. Otherwise show the `install` command exactly as printed and ask for a yes to that command alone; never compose another one. Only on a yes run it from the folder of the platform, then `git status --porcelain -- package.json <the lock file>`: if either changed, restore it with `git restore --` and say which. Then run the preflight again. If the install fails, show its error and stop: do not retry it with package scripts or another command, and do not drive. If the person says no, stop without driving; the issue stays as it is. After an install, if the person's dev server is already running, tell them to restart it before you check the address again; never restart it yourself.
- `4`: Playwright does not resolve from the project. Install nothing: say that Playwright is missing from the development dependencies of the project, that `/relevo:init` adds it once for everyone (or `npm install -D playwright` in the folder of the platform, committed on the base branch), and stop without driving.
- `5`: the Chromium of Playwright is missing. It lives outside the project: ask for permission, and only on a yes run `npx playwright install chromium` from the folder of the platform, then run the preflight again.
- `6`: the app does not answer, or one of its modules answers 400 or more (`detail` names it). Keep its `start` and `env` for step 3: the person starts the app there. If the app was already running and a module fails, tell them to restart their server; never do it yourself.
- `0`: ready.

### 3. Brief the person, then stop

Tell the person to start the app on the device themselves (for example `flutter run -d <serial>` in another terminal). For a `browser` adapter, tell them the exact command to start it in their own terminal: the `start` of the preflight, with the variable names of its `env` and the address under review. Then show:

0. The **brief**, computed and not written by you: save the issue body and the `built` comment outside the working tree (`gh issue view $ARGUMENTS --json title,body,comments`), then `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-brief.mjs --issue $ARGUMENTS --title "<title>" --body-file <body> --built-file <the built comment> --language <language> --autopilot <review.autopilot> --kind <the kind of the adapter>`. It prints about five lines: what was asked, the outcome, what to check first and how many lines there are to check, and, with `precheck` or `verify`, a fixed note that the person confirms every line. Show them as they are.
1. A **shot list**, except in an `api` review, which takes no capture and has none: two or three screenshots worth taking, named like `01_initial`, `02_action`, `03_result`, taken from the scenarios. For a change with nothing visible, say there are no screenshots to take and the log will be audited anyway. In a browser review, each shot also names what proves the page shows that state and no other shot's (the text of the alert, the heading, the URL): it becomes the check of its capture.
2. The **checklist**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/checklist.mjs openspec/changes/<change folder>`, one numbered line per scenario, edge cases included. Point out any step the person must do outside the app, because you will not do it.
3. In an `api` review with `precheck` or `verify`, the **plan of the walk**, which you write after reading the tests of the project (read them; do not run or write one yet): one line per checklist line, `<n>. test: <the class and method that covers it, and the filter you will use>`, or `<n>. person: no test covers it`. When the profile has a `serve`, add a line `server <port>: <the command with {port}, the variables of env and the url>` for each line that needs it, before the person confirms the data. With `review.autopilot` `off` there is no plan: the person runs the tests.
   With `review.autopilot` `precheck` or `verify` in any other review, the **plan of the walk**, so the person does not have to ask: one line per checklist line you walk yourself, `<n>. <method>: <how>`, where the method is `browser` (a Playwright assertion), `command` (an npm script of `package.json`, such as typecheck, lint, test or build), `read` (code, CI or docs) or `server <port>` (a run against a server you start with another configuration: say which variables are set or removed). Then the lines left to the person. Every configuration you will start is listed here, before the person confirms the data (Autopilot, step 1), so that confirmation covers them too.
4. What they can write: `capture <name>` (not in an `api` review), `ran <exit code>` (an `api` review: they ran the tests; add `--tests <n>` when they know how many ran), `ok <numbers>` (or `ok all`), `fail <number> <what went wrong>`, `retest <numbers>`, `done`. They may write in any language; understand the intent.

**Then end your turn.** Make no further tool calls until the person writes. Do not advance on your own and do not run the log audit early.

### 4. While the person tests

Handle each message as it comes:

- `ran <exit code>` (an `api` review): `review-state.mjs ran <exit code> [--tests <n>] [--failing <test names, comma separated>]`; it is recorded as the person's run. The audit needs one: a run that passes writes nothing to the log, so the recorded run is what shows that the code was exercised. If they say which tests failed, record them with `--failing`.
- `capture <name>`: in an `api` review say that this adapter takes no capture and record nothing. Otherwise `node ${CLAUDE_PLUGIN_ROOT}/scripts/capture.mjs <name>`, then record it with `review-state.mjs capture <path>`. Reply with the saved path only. If the script rejects the name, show its message and ask for another. In a browser review there is no device to capture: add the shot, with its check, to the shot list and to the review script, which then needs QA again (Autopilot, step 4).
- `ok <numbers>`: `review-state.mjs set <n> ok` for each. `fail <n> <note>`: `review-state.mjs set <n> fail <note>`. `retest <numbers>`: `review-state.mjs set <n> pending` for each, so the line must be confirmed again (useful after a fix).
- A bug or something that looks wrong: do not edit anything. Record it as a `fail` and say the fix goes through `/relevo:fix $ARGUMENTS`; the review can resume afterwards.
- `waive <number> <reason>`: the person's decision, available once the audit has findings; run `review-state.mjs waive <number> <reason>`. It refuses an empty reason and an inconclusive audit; show its message.
- `done`: go to step 5.

After **each** message of the person, in a `device` review, keep the device log from being lost to its circular buffer (an `api` review reads files that nothing overwrites, so it has nothing to drain): `adb -s <serial> logcat -d -v threadtime | node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs drain` and then `adb -s <serial> logcat -c`. The audit reads what was kept.

Never go to step 5 without an explicit `done` (or the equivalent in the person's language).

Captures belong to this step: the shot list is taken while the person tests, before the agreement, and `review-state.mjs capture` refuses after `agree`. If the person asks for screenshots after agreeing, point to the files already in `evidence/` and do not drive again.

### Autopilot (only when `review.autopilot` is `precheck` or `verify`)

When it is `off` skip this section: the person does everything. The person always confirms the lines and gives the agreement; nothing here replaces that.

1. **Confirm the data.** Before any driven step, ask the person to confirm in writing that the app points to data that is not production. Record it only after they say so: `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs confirm-env`. Without it `precheck` and `auto` are refused.
2. **Walk the lines.** `precheck`: after you walk a line, record your own result with `review-state.mjs precheck <n> ok|fail <note>`; the line stays pending until the person writes `ok`. `verify`: in addition, when the `THEN` of a line was proved by an assertion, a semantic finder or the log, or by the exit code of a project command, record `review-state.mjs auto <n> <what proved it>`; the person confirms the other lines. A line about appearance, animation or fidelity to an image is never marked automatically. A line checked only by reading code, CI or docs is recorded with `precheck` and what you found, never with `auto`.
   - **Project commands.** Run the npm script of `package.json` that the line names (typecheck, lint, test, build), never a script that fixes or formats files. Run `git status --porcelain` before and after: if a tracked file changed, restore it with `git restore -- <file>` and tell the person which file changed. Record the command and its exit code as what proved the line.
3. **Flutter on a device.** Drive through the Dart and Flutter MCP tools: `launch_app`, `connect_dart_tooling_daemon`, then `flutter_driver` (`get_health`, `waitFor`, `tap`, `enter_text`, `scroll`, `screenshot`), `get_runtime_errors`, `get_app_logs`, and `hot_reload` after a micro-fix. It needs `lib/main_driver.dart` with `enableFlutterDriverExtension()`. Rules: never pass `timeout` to `flutter_driver` (it breaks the MCP server); find widgets only by semantic finders (text, key, tooltip, type), never by coordinates; if a finder fails twice, stop driving and go back to manual for that line; the log of the MCP server is the source of the audit, and if it does not answer or is empty the audit is inconclusive.
4. **A browser (Vue, or Flutter on the web).** Write a Playwright script from the scenarios to `evidence/review-web.mjs`: it exports a default async function that receives `{ page, baseUrl, line, credentials, capture }`, uses `node:assert/strict`, and calls `line(<checklist number>, "<what is asserted>", async () => { ... })` once per line it can check. Every `THEN` it covers must have an assertion that would fail if the feature did not exist (text, URL, response, absence of errors), not a screenshot. A test login is read with `credentials("NAME")` where `NAME` is an environment variable the person names; you never read, print or store its value.
   - **Screenshots.** Turn the shot list into `capture("<name>", async () => { <the check of that shot> }, { fullPage: true })` calls. The check runs first, and when it fails no screenshot is taken and the capture is reported as failed. `capture` is the only way to take one: the runner refuses `page.screenshot`, any file path, and anything the script prints goes to `script-console.txt`, never to you. You never open the PNG files; their paths are all you see.
   - **QA.** Then launch `relevo:qa` on the script, read-only, with the shot list: it rejects a `capture` name that is not on the shot list, and a check that would also hold for another shot (for example only `[role="alert"]` for two different errors). Only if it answers `QA PASSED`, record that exact script with `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs qa-pass evidence/review-web.mjs`. Any change to the script afterwards, even one port, needs `relevo:qa` and `qa-pass` again: the runner refuses a script whose content QA did not pass.
   - **The normal run.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/web-preflight.mjs --url <the address of the app>` again: it must exit 0. Then run `node ${CLAUDE_PLUGIN_ROOT}/scripts/web-review.mjs --script evidence/review-web.mjs --url <the address of the app> --allow-origins <review.allowed_origins> --secret-env <the names> --out evidence`. The runner itself refuses before any browser starts when the state has no confirmation of the data, the autopilot is `off` or the review is already agreed. The browser is its own, with a clean profile, and can reach only `localhost`, the address under review and `review.allowed_origins`; a refused script is not run in any other way. Its `auto-ok` lines are recorded as in step 2, its `auto-fail` lines as `precheck <n> fail` with the message, its captures are already recorded in the review state, and `evidence/web-log.txt` is the log of step 5 (audit with `--package web`). When it says `the page itself failed`, that is the cause to tell the person, not the selector timeout after it. The script checks are a tripwire, not a sandbox: if it touches anything sensitive, show it to the person before it runs.
   - **Runs with another configuration** (the `server <port>` lines of the plan). Start each server yourself on a free localhost port with `node ${CLAUDE_PLUGIN_ROOT}/scripts/extra-server.mjs start --port <port> [--set NAME=value] [--unset NAME] -- npx vite --port <port> --strictPort`. It refuses a busy port and refuses `--unset` while an environment file exists (the dev server loads it by itself): then that line is pre-checked by reading the code or left for the person. Wait until it answers with `web-preflight.mjs --url http://localhost:<port> --wait 30000`, confirm it with `extra-server.mjs check --port <port>`, and run the same script with `--url http://localhost:<port> --out evidence/run-<port>`: each run has an output folder of its own, and these logs are never audited, because they show errors on purpose. Stop each one afterwards with `extra-server.mjs stop --port <port>`. The server the person started is never stopped or restarted.
5. **An `api` review.** With `precheck` or `verify` and the data confirmed, prove a line only with the test that already covers it: run the base command of the profile's `review.test` (default `php artisan test`) from the folder of the platform with `--filter <the test>`, then record the run with `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs ran <exit code> --by agent --line <n> --tests <how many ran> --filter <the filter>` (the test output prints the count as JSON when the run is not interactive). Then `precheck <n> ok <the test>` and, in `verify`, `auto <n> <the test that proved it and its exit code>`; the script refuses both unless that run exited 0 and ran at least one test, because a filter that matches nothing proves nothing. A line with no covering test, or whose test does not assert its `THEN`, is left to the person with a note. Never write or edit a test. Run `git status --porcelain` before and after each run and restore any tracked file that changed, as for any project command. Run the whole suite once at the end and record it too (`ran <exit code> --by agent --tests <n>`).
   - **Server (only when the profile has `serve`).** For a line that needs the app answering requests: pick a free port, start it with `node ${CLAUDE_PLUGIN_ROOT}/scripts/extra-server.mjs start --port <port> --set NAME=value... -- <the serve command>` (the script replaces `{port}` in the command), wait until the `url` with `{port}` replaced answers (`web-preflight.mjs --url <it> --wait 30000` is the readiness probe), check it with `extra-server.mjs check --port <port>`, make requests only to that `localhost` port (`review.allowed_origins` does not apply), and stop it afterwards with `extra-server.mjs stop --port <port>`. Without a `serve` block start nothing and leave those lines to the person. Never start a server against a database the person did not confirm.
6. **Never** drive in the person's own browser, on an origin that is not allowed, with coordinates, with `adb shell input`, Appium or Maestro, or send a message or make a call in another app.

### 5. Audit the log

In an `api` review there is no device log: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs audit`. It reads what the log files received since `init`, together with the test runs recorded, and prints the same verdicts. A clean run with an empty slice is `REVIEW PASSED`; `REVIEW INCONCLUSIVE` means no run is recorded (ask the person to run the tests and say so, or run them yourself in `precheck` or `verify`) or a log file could not be read (the report says which), and it cannot be waived. A failing run is `REVIEW REJECTED` and names the failing tests. For the micro-fix loop of an `api` review, after the fix and QA run the tests again and record the run, take the log as it is with `review-state.mjs reset-log`, and audit again; the latest run of each line replaces the one before. Skip the rest of this step.

```bash
package=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/app-id.mjs)
adb -s <serial> logcat -d -v threadtime | node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs audit --accumulated --package "$package"
```

For a `browser` adapter there is no device: audit only the log of the normal run, never one of `evidence/run-<port>/`:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs audit evidence/web-log.txt --package web
```

`app-id.mjs` prints the application id of the project. The audit then looks only at the lines written by that app's processes, so other apps on the device are neither audited nor quoted. If `app-id.mjs` finds no id, run the audit without `--package`.

It prints `REVIEW PASSED`, `REVIEW REJECTED` with the numbered findings, or `REVIEW INCONCLUSIVE`, and writes `evidence/review-report.md`. **Inconclusive** means the log was empty or had no line of the app: it proves nothing, it is not a pass and it cannot be waived. Ask the person to start the app again, repeat the steps, and audit once more.

A rejected audit can end in the person waiving every finding with a reason: the verdict then reads `REVIEW PASSED (with waivers)` and `decide` accepts it.

If it is `REVIEW REJECTED`, offer a micro-fix loop and wait for the person to accept. On a yes: launch `relevo:dev` in **fix** mode with exactly the log findings, then `relevo:qa`; commit the fix before anything else: `node ${CLAUDE_PLUGIN_ROOT}/scripts/commit-change.mjs --message "fix: <summary> (#$ARGUMENTS)" --within "<path>" --change "<change>" -- <the files the developer reported>` (it stages exactly those files, scans them and refuses on a finding); ask the person to restart the app and repeat the affected steps; clear the log (`adb -s <serial> logcat -c`) and audit again. At most twice. Anything beyond a console error (a wrong behaviour) is not a micro-fix: it goes through `/relevo:fix`.

### 6. Decide

Ask the person about any checklist line still unconfirmed. When the audit passed and every line is confirmed (by the person, or verified automatically in `verify`), ask whether to open the pull request. Only on a clear yes: `review-state.mjs agree`.

Then `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs decide`. If it exits non-zero it prints the reasons: report them to the person, leave the issue `in-review`, and stop. **Do not open the pull request.**

### 7. Open the pull request

Only when `decide` exited 0.

1. Scan what you are about to publish; if it reports anything, stop and do not push:
   ```bash
   git diff origin/<base>...HEAD | node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-diff.mjs
   ```
2. `git push -u origin <branch>` (a normal push).
3. Write the body to a file: the issue title, `Closes #$ARGUMENTS`, the QA verdict, the audit verdict (`REVIEW PASSED` or `REVIEW PASSED (with waivers)`), the checklist with every line ticked (`checklist.mjs openspec/changes/<change folder> --state evidence/review-state.json`), and, when there are waivers, the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs waived` (the waived findings with the person's reasons) and, when the agent verified lines automatically, the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs auto-list` (the lines verified automatically, and how). In an `api` review also add the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs runs-list`: which test runs were the person's and which were the agent's. No images, no links to this session, no attribution lines.
4. Pick the reviewer, unless `review.mode` is `none`: `node ${CLAUDE_PLUGIN_ROOT}/scripts/pick-reviewer.mjs --repo <owner/name> --author <your GitHub login> --pr <next PR number or 0>`. It picks, among `team.members` without the author and the spec writer (in `roles` mode, only `team.approvers`), the person with the fewest open review requests, ties in rotation. If it prints `null`, you handle it after the pull request exists (step 6).
5. First look for one that already exists: `gh pr list --head <branch> --state open --json number,url`. If there is one, reuse it: create nothing, tell the person its link and go on to step 6. If `git push` was rejected, stop and show git's message and the likely cause (the remote branch moved: `git pull --ff-only origin <branch>`, never a force-push). Otherwise `gh pr create --base <base> --head <branch> --title "<title> (#$ARGUMENTS)" --body-file <file>`, adding `--reviewer <login>` when there is one. Open it **ready for review, not as a draft**.
6. Move the issue to `pr-open`: `label-change.mjs --to pr-open --current "..."`, applied with `gh issue edit`. If nobody was eligible, also run `node ${CLAUDE_PLUGIN_ROOT}/scripts/needs-reviewer.mjs --repo <owner/name> --issue $ARGUMENTS --title "<title>" --pr-url <pull request URL>`: it adds `needs-reviewer` next to `pr-open` and mentions the spec writer.

### 8. Evidence

- `evidence.policy: local_only`: delete the `evidence/` folder now. Nothing is attached anywhere.
- `evidence.policy: attach_to_pr`: GitHub has no API for attaching images, so you cannot upload them. List only the images, in every run folder (`find evidence -name '*.png'`), and ask the person to drag them into the pull request description; the logs, results and scripts repeat what the body already says. Keep the folder until they say they did, then delete it. When there is no image, delete the folder without asking and say there was nothing to attach.

### 9. Return to base branch

Restore the working tree to the base branch so the workspace remains clean on the base branch for other tasks or subsequent reviews, but only where that is possible: in the main checkout, when no other worktree holds the base branch, and when no dev server of the address under review runs from the working tree (switching would remove its files under it and break it until it is restarted).

For a `browser` adapter, first stop the servers you started, then ask the guard:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/extra-server.mjs stop --all
node ${CLAUDE_PLUGIN_ROOT}/scripts/dev-server-guard.mjs --url <the address of the app>
```

For an `api` review, stop the servers you started (`extra-server.mjs stop --all`) and skip the guard unless the person started a server of their own; then restore the base branch with the command below when it can be.

Switch only when the guard exits 0. On 1 a server runs from the working tree; on 3 the guard cannot tell. In both cases do not switch: say why, and that the person can stop their server and run `git switch <base>` themselves.

```bash
[ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] && ! git worktree list --porcelain | grep -qx "branch refs/heads/<base>" && git switch <base>
```

If the condition does not hold (a separate worktree, or the base branch is checked out elsewhere), do not switch: say which branch the working tree stays on. If `git switch` fails, say so; it never changes the verdict or the state of the issue, because the pull request already exists.

## Report

Finish with one short block: the issue, the review verdict, the checklist result, the pull request link (or why none was opened), and the issue's new state.
