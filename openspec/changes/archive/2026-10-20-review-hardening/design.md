## Context

See `proposal.md`. Facts that shape the design:

- `auditLog` is a pure function over text; `filterByApp` already returns the scope (`pids` empty when the process is not named). The audit command stores `{ verdict, counts, findings }` in `evidence/review-state.json`, and `decidePr` reads `state.audit.verdict`.
- `review` is a skill: prose over scripts. What cannot be proved here (the real buffer of a device) is marked as such.
- `evidence/` is never committed; the pull request body is written by the skill from `checklist.mjs` and the state.

## Goals / Non-Goals

**Goals:** an audit that cannot pass on no evidence; a way for the person to accept a known finding on the record; a micro-fix that reaches the pull request; a review of the current code, by the right person, without a duplicate pull request.

**Non-Goals:** adapters per target, the Autopilot, `flutter_driver`, Playwright (next change); confirming the circular buffer on a device; reviewing a backend.

## Decisions

**D1. The verdict is computed in one place.** `auditLog(text, { scope })` gains an optional `scope`; the audit returns `REVIEW INCONCLUSIVE` when `text.trim()` is empty, or when `scope` says a package was requested and its pids were not found (`scope.pids` empty). Without `--package` (no application id found) an empty log is still inconclusive, a non-empty one is audited as a whole. The report states the reason. `decidePr` treats any verdict other than `REVIEW PASSED` and `REVIEW PASSED (with waivers)` as not approved, and says "the log audit was inconclusive" for that one.

**D2. Waivers live in the state, not in the audit.** `state.waivers = [{ class, excerpt, reason }]`. `review-state.mjs waive <n> <reason...>` takes the n-th finding of `state.audit.findings` (the numbering the audit prints), refuses an empty reason, refuses when the audit is inconclusive, and refuses a number that does not exist. `audit` recomputes the verdict after reading the log: findings whose `class` and `excerpt` match a waiver are marked `waived: true`; if there are findings and all are waived the verdict is `REVIEW PASSED (with waivers)`. `syncState` clears `waivers`. The agent has no command of its own to waive: the skill says the waiver is the person's, and only `waive` written by the person triggers it.

**D3. The report and the PR body.** `auditReport` lists waived findings in their own section with the reasons. A new `waivedSection(state)` in `review-state.mjs` returns the markdown "Waived findings" (empty string when none) and the command `review-state.mjs waived` prints it for the skill to add to the body.

**D4. Draining the log.** `review-state.mjs drain` reads the log from stdin and appends it to `evidence/device.log`; the skill then runs `adb logcat -c`. `audit` gains `--accumulated`, which audits `evidence/device.log` plus whatever is still in stdin. Because the buffer behaviour is unverified, the skill says to drain after each message and the findings page records that it was not seen on a device.

**D5. The micro-fix commit.** Step 5 of the skill commits through `commit-change.mjs --message "fix: <summary> (#<issue>)" --within <platform path> --change <id> -- <files the developer reported>`, the same script `fix` and `go` use.

**D6. Who runs it.** `scripts/review-who.mjs --assignee <login> --login <login>` exits 0 when they are the same (case-insensitive) and 1 when not, printing both. The skill reads the assignee from the issue and the login from `gh api user --jq .login`.

**D7. Pull request lookup and push.** The skill runs `gh pr list --head <branch> --state open --json number,url` before `gh pr create`; a result means reuse. A rejected push stops with the message from git; the skill never adds `--force`. The existing tests that forbid force pushes keep covering it.

**D8. Bringing in the branch.** Step 1 becomes `git fetch origin <base> <branch>`, `git switch <branch>`, `git pull --ff-only origin <branch>`, then the merge of the base. If the pull cannot fast-forward, stop and tell the person the local and remote branch diverged (never rebase or reset).

**D9. Locating the change.** `openspec list --json` gives the change whose name starts with `$ARGUMENTS-`; `review: ['list']` is added to the table of allowed OpenSpec commands and the existing test compares the skill with it.

## Risks / Trade-offs

- A waiver is a hole by design, so it is the person's, with a reason, and visible in the pull request. The agent cannot create one.
- The inconclusive verdict can annoy someone whose app logs nothing at all on a clean run: the person restarts the app (the skill already asks for it). A fully silent app still logs its process start in the system log, which is what the filter uses.
- Matching waivers by excerpt means a finding whose text changes (a different line number in a stack trace) needs a new waiver; the alternative, matching by class only, would waive too much.
