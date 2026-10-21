---
name: review
description: Guides the review of a built issue on the platform it was built for. By default the person drives the app on a device and you only observe: you save screenshots on request and audit the log when they say they are done. When review.autopilot is precheck or verify, you may also walk the checklist through semantic finders or a browser of its own, within fixed limits, and the person still confirms and agrees. When everything is verified and they agree, it opens the pull request. Use only when asked to run review for an issue number. It needs a connected device or a browser, so it runs on a person's machine.
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

The only `adb` commands you may run are: list devices, clear or read the log (`logcat`), and the screenshot taken by `capture.mjs`.

## Steps

### 0. Preflight

Stop with a clear message, changing nothing, if any of these fails:

- `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-config.mjs relevo.yml` exits non-zero. Show its output.
- `git check-ignore -q evidence/` fails: the evidence folder is not ignored by git. Tell the person to add `evidence/` to `.gitignore`.
- The issue is not `built` (or `in-review`, to resume). Say which state it is in and what to do (`/relevo:go`, `/relevo:fix`).
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-adapter.mjs --platform <platform>` (the platform of the issue, from `platform-of.mjs`) exits 1: no review is possible for that platform and target; show the `reason` and stop, changing nothing. If it prints `needs_autopilot: true` and `review.autopilot` is `off`, stop and tell the person to set `review.autopilot` to `precheck` or `verify` in `relevo.yml`: a browser has no manual review.
- For an adapter whose kind is `device`: `node ${CLAUDE_PLUGIN_ROOT}/scripts/device.mjs` exits non-zero. Show its message: it says what to connect or authorise. Keep the serial it prints as `<serial>`. A `browser` adapter needs no device.

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

### 3. Brief the person, then stop

Tell the person to start the app on the device themselves (for example `flutter run -d <serial>` in another terminal). Then show:

0. The **brief**, computed and not written by you: save the issue body and the `built` comment outside the working tree (`gh issue view $ARGUMENTS --json title,body,comments`), then `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-brief.mjs --issue $ARGUMENTS --title "<title>" --body-file <body> --built-file <the built comment> --language <language>`. It prints about five lines: what was asked, the outcome, what to check first and how many lines there are to check. Show them as they are.
1. A **shot list**: two or three screenshots worth taking, named like `01_initial`, `02_action`, `03_result`, taken from the scenarios. For a change with nothing visible, say there are no screenshots to take and the log will be audited anyway.
2. The **checklist**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/checklist.mjs openspec/changes/<change folder>`, one numbered line per scenario, edge cases included. Point out any step the person must do outside the app, because you will not do it.
3. What they can write: `capture <name>`, `ok <numbers>` (or `ok all`), `fail <number> <what went wrong>`, `retest <numbers>`, `done`. They may write in any language; understand the intent.

**Then end your turn.** Make no further tool calls until the person writes. Do not advance on your own and do not run the log audit early.

### 4. While the person tests

Handle each message as it comes:

- `capture <name>`: `node ${CLAUDE_PLUGIN_ROOT}/scripts/capture.mjs <name>`, then record it with `review-state.mjs capture <path>`. Reply with the saved path only. If the script rejects the name, show its message and ask for another.
- `ok <numbers>`: `review-state.mjs set <n> ok` for each. `fail <n> <note>`: `review-state.mjs set <n> fail <note>`. `retest <numbers>`: `review-state.mjs set <n> pending` for each, so the line must be confirmed again (useful after a fix).
- A bug or something that looks wrong: do not edit anything. Record it as a `fail` and say the fix goes through `/relevo:fix $ARGUMENTS`; the review can resume afterwards.
- `waive <number> <reason>`: the person's decision, available once the audit has findings; run `review-state.mjs waive <number> <reason>`. It refuses an empty reason and an inconclusive audit; show its message.
- `done`: go to step 5.

After **each** message of the person, keep the device log from being lost to its circular buffer: `adb -s <serial> logcat -d -v threadtime | node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs drain` and then `adb -s <serial> logcat -c`. The audit reads what was kept.

Never go to step 5 without an explicit `done` (or the equivalent in the person's language).

### Autopilot (only when `review.autopilot` is `precheck` or `verify`)

When it is `off` skip this section: the person does everything. The person always confirms the lines and gives the agreement; nothing here replaces that.

1. **Confirm the data.** Before any driven step, ask the person to confirm in writing that the app points to data that is not production. Record it only after they say so: `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs confirm-env`. Without it `precheck` and `auto` are refused.
2. **Walk the lines.** `precheck`: after you walk a line, record your own result with `review-state.mjs precheck <n> ok|fail <note>`; the line stays pending until the person writes `ok`. `verify`: in addition, when the `THEN` of a line was proved by an assertion, a semantic finder or the log, record `review-state.mjs auto <n> <what proved it>`; the person confirms the other lines. A line about appearance, animation or fidelity to an image is never marked automatically.
3. **Flutter on a device.** Drive through the Dart and Flutter MCP tools: `launch_app`, `connect_dart_tooling_daemon`, then `flutter_driver` (`get_health`, `waitFor`, `tap`, `enter_text`, `scroll`, `screenshot`), `get_runtime_errors`, `get_app_logs`, and `hot_reload` after a micro-fix. It needs `lib/main_driver.dart` with `enableFlutterDriverExtension()`. Rules: never pass `timeout` to `flutter_driver` (it breaks the MCP server); find widgets only by semantic finders (text, key, tooltip, type), never by coordinates; if a finder fails twice, stop driving and go back to manual for that line; the log of the MCP server is the source of the audit, and if it does not answer or is empty the audit is inconclusive.
4. **A browser (Vue, or Flutter on the web).** Write a Playwright script from the scenarios to `evidence/review-web.mjs`: it exports a default async function that receives `{ page, baseUrl, line, credentials }`, uses `node:assert/strict`, and calls `line(<checklist number>, "<what is asserted>", async () => { ... })` once per line it can check. Every `THEN` it covers must have an assertion that would fail if the feature did not exist (text, URL, response, absence of errors), not a screenshot. A test login is read with `credentials("NAME")` where `NAME` is an environment variable the person names; you never read, print or store its value. Then launch `relevo:qa` on the script, read-only. Only if it answers `QA PASSED`, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/web-review.mjs --script evidence/review-web.mjs --url <the address of the app> --allow-origins <review.allowed_origins> --secret-env <the names>`. The browser is its own, with a clean profile, and can reach only `localhost`, the address under review and `review.allowed_origins`; a refused script is not run in any other way. Its `auto-ok` lines are recorded as in step 2, its `auto-fail` lines as `precheck <n> fail` with the message, and `evidence/web-log.txt` is the log of step 5 (audit with `--package web`). The script checks are a tripwire, not a sandbox: if it touches anything sensitive, show it to the person before it runs.
5. **Never** drive in the person's own browser, on an origin that is not allowed, with coordinates, with `adb shell input`, Appium or Maestro, or send a message or make a call in another app.

### 5. Audit the log

```bash
package=$(node ${CLAUDE_PLUGIN_ROOT}/scripts/app-id.mjs)
adb -s <serial> logcat -d -v threadtime | node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs audit --accumulated --package "$package"
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
3. Write the body to a file: the issue title, `Closes #$ARGUMENTS`, the QA verdict, the audit verdict (`REVIEW PASSED` or `REVIEW PASSED (with waivers)`), the checklist with every line ticked (`checklist.mjs openspec/changes/<change folder> --state evidence/review-state.json`), and, when there are waivers, the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs waived` (the waived findings with the person's reasons) and, when the agent verified lines automatically, the output of `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs auto-list` (the lines verified automatically, and how). No images, no links to this session, no attribution lines.
4. Pick the reviewer, unless `review.mode` is `none`: `node ${CLAUDE_PLUGIN_ROOT}/scripts/pick-reviewer.mjs --repo <owner/name> --author <your GitHub login> --pr <next PR number or 0>`. It picks, among `team.members` without the author and the spec writer (in `roles` mode, only `team.approvers`), the person with the fewest open review requests, ties in rotation. If it prints `null`, you handle it after the pull request exists (step 6).
5. First look for one that already exists: `gh pr list --head <branch> --state open --json number,url`. If there is one, reuse it: create nothing, tell the person its link and go on to step 6. If `git push` was rejected, stop and show git's message and the likely cause (the remote branch moved: `git pull --ff-only origin <branch>`, never a force-push). Otherwise `gh pr create --base <base> --head <branch> --title "<title> (#$ARGUMENTS)" --body-file <file>`, adding `--reviewer <login>` when there is one. Open it **ready for review, not as a draft**.
6. Move the issue to `pr-open`: `label-change.mjs --to pr-open --current "..."`, applied with `gh issue edit`. If nobody was eligible, also run `node ${CLAUDE_PLUGIN_ROOT}/scripts/needs-reviewer.mjs --repo <owner/name> --issue $ARGUMENTS --title "<title>" --pr-url <pull request URL>`: it adds `needs-reviewer` next to `pr-open` and mentions the spec writer.

### 8. Evidence

- `evidence.policy: local_only`: delete the `evidence/` folder now. Nothing is attached anywhere.
- `evidence.policy: attach_to_pr`: GitHub has no API for attaching images, so you cannot upload them. List the files in `evidence/` and ask the person to drag them into the pull request description. Keep the folder until they say they did, then delete it.

### 9. Return to base branch

Restore the working tree to the base branch so the workspace remains clean on the base branch for other tasks or subsequent reviews:

```bash
git switch <base>
```

## Report

Finish with one short block: the issue, the review verdict, the checklist result, the pull request link (or why none was opened), and the issue's new state.
