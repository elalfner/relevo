---
name: review
description: Guides the on-device review of a built issue. The person drives the app on an Android device; you only observe: you save screenshots on request and audit the device log when they say they are done. When everything is verified and they agree, it opens the pull request. Use only when asked to run review for an issue number. It needs a connected device, so it runs on a person's machine.
argument-hint: "[issue-number]"
disable-model-invocation: true
---

# Relevo review

Review the built issue `$ARGUMENTS` with a person who uses the app on a real device. You are the observer: you capture screens when asked and you audit the log at the end. The person tests; you never do.

Scripts live in `${CLAUDE_PLUGIN_ROOT}/scripts/`. Run them with `node`. They hold the rules that must not vary (checklist, log audit, when a pull request may open, which names are safe); use them instead of judging those things yourself.

## What you must never do

- Never tap, swipe, type or press keys on the device: no `adb shell input`, no monkey, no UI-automation tool, no Flutter driver. The person does everything in the app.
- Never send a message, make a call or press a send button in any other app. If a step needs it (for example sending something through a messaging app), the person does it.
- Never open the screenshots. They can show real customer data. They are saved to disk and nothing else.
- Never patch code during the review. A defect found here goes through `/relevo:fix`.
- Never commit the `evidence/` folder, and never force-push.

The only `adb` commands you may run are: list devices, clear or read the log (`logcat`), and the screenshot taken by `capture.mjs`.

## Steps

### 0. Preflight

Stop with a clear message, changing nothing, if any of these fails:

- `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-config.mjs relevo.yml` exits non-zero. Show its output.
- `git check-ignore -q evidence/` fails: the evidence folder is not ignored by git. Tell the person to add `evidence/` to `.gitignore`.
- The issue is not `built` (or `in-review`, to resume). Say which state it is in and what to do (`/relevo:go`, `/relevo:fix`).
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/device.mjs` exits non-zero. Show its message: it says what to connect or authorise. Keep the serial it prints as `<serial>`.

Find the repository (`$GITHUB_REPOSITORY`, or `gh repo view --json nameWithOwner -q .nameWithOwner`), the issue's branch (`git branch -r --list "origin/feature/$ARGUMENTS-*"`) and its change folder (`openspec/changes/$ARGUMENTS-*`).

### 1. Synchronise with the base branch

The person must never review a stale base.

```bash
git fetch origin <base> <branch>
git switch <branch>
git merge --no-edit origin/<base>
```

If the merge conflicts, run `git merge --abort`, leave the issue as `built`, tell the person which files conflict, and stop.

If the merge brought in changes, launch the `relevo:qa` agent again on the result (same change folder, rules file `qa.rules_from`, base branch). If it rejects, stop and tell the person to run `/relevo:fix $ARGUMENTS`; the issue stays `built`.

When the synchronisation succeeded, claim the issue: `node ${CLAUDE_PLUGIN_ROOT}/scripts/label-change.mjs --to in-review --current "<current labels>"`, applied with `gh issue edit`.

### 2. Start, or resume

If `evidence/review-state.json` exists for this issue, resume: show the confirmed lines and captures it already holds, and continue at step 4. If a fix changed the specification since the state was saved, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs sync openspec/changes/<change folder>` first: confirmed lines stay, failed lines and new scenarios are pending.

Otherwise: `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs init openspec/changes/<change folder>`, then clear the log so the audit only sees this session: `adb -s <serial> logcat -c`.

### 3. Brief the person, then stop

Tell the person to start the app on the device themselves (for example `flutter run -d <serial>` in another terminal). Then show:

1. A **shot list**: two or three screenshots worth taking, named like `01_initial`, `02_action`, `03_result`, taken from the scenarios. For a change with nothing visible, say there are no screenshots to take and the log will be audited anyway.
2. The **checklist**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/checklist.mjs openspec/changes/<change folder>`, one numbered line per scenario, edge cases included. Point out any step the person must do outside the app, because you will not do it.
3. What they can write: `capture <name>`, `ok <numbers>` (or `ok all`), `fail <number> <what went wrong>`, `retest <numbers>`, `done`. They may write in any language; understand the intent.

**Then end your turn.** Make no further tool calls until the person writes. Do not advance on your own and do not run the log audit early.

### 4. While the person tests

Handle each message as it comes:

- `capture <name>`: `node ${CLAUDE_PLUGIN_ROOT}/scripts/capture.mjs <name>`, then record it with `review-state.mjs capture <path>`. Reply with the saved path only. If the script rejects the name, show its message and ask for another.
- `ok <numbers>`: `review-state.mjs set <n> ok` for each. `fail <n> <note>`: `review-state.mjs set <n> fail <note>`. `retest <numbers>`: `review-state.mjs set <n> pending` for each, so the line must be confirmed again (useful after a fix).
- A bug or something that looks wrong: do not edit anything. Record it as a `fail` and say the fix goes through `/relevo:fix $ARGUMENTS`; the review can resume afterwards.
- `done`: go to step 5.

Never go to step 5 without an explicit `done` (or the equivalent in the person's language).

### 5. Audit the log

```bash
adb -s <serial> logcat -d -v time | node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs audit
```

It prints `REVIEW PASSED` or `REVIEW REJECTED` with the first findings, and writes `evidence/review-report.md`.

If it is `REVIEW REJECTED`, offer a micro-fix loop and wait for the person to accept. On a yes: launch `relevo:dev` in **fix** mode with exactly the log findings, then `relevo:qa`; ask the person to restart the app and repeat the affected steps; clear the log (`adb -s <serial> logcat -c`) and audit again. At most twice. Anything beyond a console error (a wrong behaviour) is not a micro-fix: it goes through `/relevo:fix`.

### 6. Decide

Ask the person about any checklist line still unconfirmed. When the audit passed and every line is confirmed, ask whether to open the pull request. Only on a clear yes: `review-state.mjs agree`.

Then `node ${CLAUDE_PLUGIN_ROOT}/scripts/review-state.mjs decide`. If it exits non-zero it prints the reasons: report them to the person, leave the issue `in-review`, and stop. **Do not open the pull request.**

### 7. Open the pull request

Only when `decide` exited 0.

1. Scan what you are about to publish; if it reports anything, stop and do not push:
   ```bash
   git diff origin/<base>...HEAD | node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-diff.mjs
   ```
2. `git push -u origin <branch>` (a normal push).
3. Write the body to a file: the issue title, `Closes #$ARGUMENTS`, the QA verdict, `REVIEW PASSED`, and the checklist with every line ticked (`checklist.mjs openspec/changes/<change folder> --state evidence/review-state.json`). No images, no links to this session, no attribution lines.
4. Pick the reviewer, unless `review.mode` is `none`: `node ${CLAUDE_PLUGIN_ROOT}/scripts/pick-reviewer.mjs --repo <owner/name> --author <your GitHub login> --pr <next PR number or 0>`. If it prints `null`, label the issue `needs-reviewer` too.
5. `gh pr create --base <base> --head <branch> --title "<title> (#$ARGUMENTS)" --body-file <file>`, adding `--reviewer <login>` when there is one. Open it **ready for review, not as a draft**.
6. Move the issue to `pr-open`: `label-change.mjs --to pr-open --current "..."`, applied with `gh issue edit`.

### 8. Evidence

- `evidence.policy: local_only`: delete the `evidence/` folder now. Nothing is attached anywhere.
- `evidence.policy: attach_to_pr`: GitHub has no API for attaching images, so you cannot upload them. List the files in `evidence/` and ask the person to drag them into the pull request description. Keep the folder until they say they did, then delete it.

## Report

Finish with one short block: the issue, the review verdict, the checklist result, the pull request link (or why none was opened), and the issue's new state.
