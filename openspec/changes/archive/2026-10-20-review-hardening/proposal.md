# Proposal

## Why

`review` is the one step where a person's judgement closes the loop, so its guards must not pass by accident. Reading its skill and scripts, and running them on small inputs, showed the following (each checked, none guessed):

- **R1.** `auditLog('')` returns `REVIEW PASSED`: an empty log (device unplugged, app not started, `adb` failing in a pipe) passes the audit. When the log never names the app's process, the whole log is audited instead, so a log full of other apps' lines, or none, also passes.
- **R2.** The micro-fix of step 5 edits the working tree, but nobody stages, scans or commits it; step 7 pushes only what is committed, so the pull request can open without the fix.
- **R3.** The device log is a circular buffer. On a long review earlier lines are lost before the audit reads it (a hypothesis, not reproduced: it needs a real device).
- **R4.** A finding that is a known false positive cannot be accepted: the only way to a pull request is to clear the log and repeat, or to leave the audit.
- **R5.** The assignee is the person who should review on a device, but `review` never compares them with who is running it.
- **R6.** Step 7 runs `gh pr create` without looking for an existing pull request for the branch, and does not say what to do when the push is rejected.
- **F2.** Step 1 merges the base into the branch but never brings in `origin/<branch>`: if `fix` or `go` pushed from another machine, the review tests old code and the push of step 7 is rejected.
- The change folder is found with a glob (`openspec/changes/$ARGUMENTS-*`) instead of asking OpenSpec.

## What Changes

- **A third verdict, `REVIEW INCONCLUSIVE`.** An empty log, or a log with no line from the app under review, is inconclusive. It is never a pass, `decide` refuses it, and it cannot be waived. The person starts the app again and repeats the steps.
- **Waivers with a written reason.** `waive <n> <reason>` is written only by the person, finding by finding, with a non-empty reason; the agent never proposes or applies one. The verdict becomes `REVIEW PASSED (with waivers)` when every finding is waived, `decide` accepts it, and the waived findings and reasons appear in the report and in the pull request body. A finding that is not waived still blocks. Waivers are matched by class and text, survive a new audit after a micro-fix, and are cleared when `sync` follows a change of the specification.
- **The micro-fix is committed** through `commit-change.mjs` as `fix: ... (#n)` before the pull request opens.
- **`drain`.** After each message from the person the log is appended to `evidence/` and cleared on the device, so the buffer cannot lose lines; the audit reads the accumulated file. Confirming that the buffer really loses lines needs a device.
- **`review` checks who runs it.** The assignee is compared with `gh api user --jq .login`; if they differ the person confirms in writing.
- **The pull request is looked up first** (`gh pr list --head`); an existing one is reused, and a rejected push stops with a message (never a force-push).
- **`origin/<branch>` is brought in** with `git pull --ff-only` before the base is merged.
- **The change folder** comes from `openspec list --json`, and the OpenSpec commands of `review` are a closed list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review`: the verdicts and the waivers, the micro-fix commit, `drain`, who runs it, the pull request lookup, bringing in the branch.

## Impact

- Code: `scripts/lib/logaudit.mjs`, `scripts/lib/review-state.mjs`, `scripts/review-state.mjs`, `scripts/lib/checklist.mjs` (waived findings in the PR body), `scripts/review-who.mjs`, `scripts/lib/openspec-commands.mjs`.
- Content: `skills/review/SKILL.md`, `docs/commands.md` and `docs/commands.es.md`, `CHANGELOG.md`.
- Not in this change (kept for the next, `review-autopilot`): the adapters per target (web and iOS have no `adb`), the Autopilot (`precheck` and `verify`), `flutter_driver`, and the Playwright script for Vue. Also not changed: the review of a backend.
