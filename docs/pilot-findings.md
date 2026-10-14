# Pilot findings: solo repository (task 3.6)

Date: 2026-10-14. Repository: a private sandbox with a minimal Flutter app, `review.mode: none`, one person. The agent ran in GitHub Actions through `anthropics/claude-code-action@v1`; the review ran on a physical Android 14 device.

This is the first time the code that talks to GitHub ran against the real API. Until now it had only been tested with simulated clients.

## Verdict

The cycle `go` → `review` → `ship` completed for one issue:

1. `relevo:ready` started the workflow. The issue moved `ready` → `building` → `built`, the branch `feature/1-add-a-reset-button-to-the-counter` was pushed, and the hand-off comment was correct.
2. `review` ran on the device: three captures, four checklist lines confirmed, `REVIEW PASSED`, pull request opened against `dev` and the issue moved to `pr-open`.
3. `ship` ran with the written confirmation: the specification was archived into `openspec/specs/` and `openspec/changes/archive/`, the pull request was squash-merged, the branch deleted, the issue closed as completed and its labels removed.

`fix` was not needed: the review found no defect, so that command was not exercised.

## What worked against the real API

| Area | Result |
|---|---|
| `go-plan.mjs` gates and `--claim` | Correct decision and labels for every path below |
| Milestone missing | Not started; comment names the missing milestone |
| Assignee missing | Not started; comment names the missing assignee |
| Incomplete specification | `needs-spec`, comment lists "edge cases"; no build |
| Dependency not merged (`Depends-on: #1`) | `blocked`, comment names #1 |
| Dependency merged | Issue built on top of the merged work |
| Capacity (`built_unreviewed_per_person: 1`, one built issue waiting) | `queued`, no branch, no build |
| `render-message.mjs` (`built`, `needs_spec`, no-milestone, no-assignee, blocked) | Text is clear and carries the right next step |
| `check-issue.mjs` | Flagged a missing "Edge cases" section and an empty title |
| `ship-check.mjs` | Correct against a real pull request, including "GitHub has not finished checking whether the pull request can be merged" right after a push (it resolved on retry) |
| `scan-diff.mjs`, `check-archive.mjs`, `stage.mjs`, `label-change.mjs` | No problems |
| `device.mjs`, `capture.mjs`, `review-state.mjs` | Worked on a real device; `audit` returned `REVIEW PASSED` |

## What failed, with the exact error

### F1. The runner cannot install the plugin from a private repository (blocking)

```
✘ Failed to add marketplace: Failed to clone marketplace repository: Cloning into '...'
fatal: unable to get password from user
##[error]Action failed with error: Failed to add marketplace 'https://github.com/<owner>/relevo.git' (exit code: 1)
```

The template uses a plain URL for `plugin_marketplaces`. That works only when the plugin repository is public. Workaround used: a read-only fine-grained token stored as a secret and put in the URL (`https://x-access-token:<token>@github.com/<owner>/relevo.git`). The marketplace and `relevo@relevo` then installed without trouble.

### F2. An unattended run can end before its subagent finishes (blocking, intermittent)

The agent started the `relevo:dev` subagent in the background and the headless session ended:

```
"subtype": "background_tasks_changed" ... "subtype": "task_started"
"result": "The dev agent is building; I'll wait for its report."
```

The run finished green after 39 s, the issue stayed on `building`, and no comment or branch appeared. It happened in both attempts on issue 2 before the fix; the build of issue 1, which ran the subagent in the foreground, worked. Fix that held: the environment variable `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1'` on the action step. The next run of the same issue built correctly. Fixed in this repository (template and skill, with tests).

### F3. Authentication failed with a subscription token that was pasted wrongly

```
"result": "Not logged in · Please run /login"
```

`claude setup-token` prints the token over two lines. Pasting it as shown broke it. Stripping whitespace (`pbpaste | tr -d '[:space:]' | gh secret set ...`) fixed it. Not a defect of Relevo, but anyone setting up the secret will meet it; the future `init` and the documentation should say so.

### F4. A failed run with `is_error` only says why when full output is on

Without `show_full_output: true` the log says only `Claude result reported subtype success with is_error:true`. With it, the actual message appears. Useful while piloting; not meant for production, since it prints the whole conversation to the log.

### F5. Preflight failure left the issue untouched and silent

`openspec list --json` reported `no_openspec_root`, because `openspec init` creates empty folders (`openspec/specs`, `openspec/changes/archive`) and git does not store empty folders. The agent stopped correctly and changed nothing, but nobody was told: the issue stayed `relevo:ready` with no comment. The same silence happens for any failure before `go-plan` (F1, F3).

### F6. The workflow has no toolchain step

The template installs Node and OpenSpec only. QA runs `flutter analyze` and `flutter test`, so a Flutter project needs a Flutter step. Added as a commented example in the template.

## Parameters of `claude-code-action` that differ from the template (task 6.4)

| Parameter | Template | Used in the pilot | Why |
|---|---|---|---|
| `anthropic_api_key` | `${{ secrets.ANTHROPIC_API_KEY }}` | not used | A subscription token was used instead |
| `claude_code_oauth_token` | not present | `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` | Run on a Pro subscription. Accepted together with `--max-budget-usd` and `--max-turns` |
| `plugin_marketplaces` | plain URL | URL with a read-only token | F1 |
| `show_full_output` | not present | `true` | F4, only while piloting |
| step `env: CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | not present | `'1'` | F2 |
| extra step `subosito/flutter-action@v2` | not present | stable channel, cached | F6 |

Confirmed against the real run, no change needed: `plugins: relevo@relevo`, `prompt: /relevo:go <n>`, `claude_args` with `--max-turns`, `--max-budget-usd` and `--allowedTools "Bash,Read,Write,Edit,Glob,Grep,Task"`, `github_token`, and the `permissions` block. The `id-token: write` permission was not exercised by anything seen in the log. The issue `labeled` event runs the workflow file from the **default branch**, not from the base branch, so workflow changes must reach `main` to take effect.

## Times and costs per run

`total_cost_usd` comes from the action's own result. With a subscription token this is the notional price, not a charge.

| Run | Outcome | Time | Turns | Cost (USD) |
|---|---|---|---|---|
| Issue 1, plugin clone fails (F1) | failure | 39 s | 0 | 0 |
| Issue 1, not logged in (F3), twice | failure | 38 s, 48 s | 1 | 0 |
| Issue 1, no OpenSpec root (F5) | stopped at preflight | 49 s | 2 | 0.050 |
| Issue 1, build | `built` | 4 min 1 s | 14 | 0.368 |
| Issue 2, subagent in background (F2), twice | stuck on `building` | 2 min 43 s, 4 min 27 s | 12, 9 | 0.158, 0.103 |
| Issue 2, after the fix | `built` | 4 min 21 s | 15 | 0.397 |
| Four exit-path runs (`blocked`, `needs-spec`, no milestone, no assignee), plus `queued` | no build | 2 min 9 s to 2 min 30 s | 3 | 0.047 to 0.049 |

A built issue costs about 0.4 USD and takes about 4 minutes of agent time for a very small change. An issue that is rejected at the gate costs about 0.05 USD and 2 minutes, almost all of it installing Flutter, OpenSpec and the plugin before the agent starts. The review on the device took the person a few minutes; the log audit and the pull request took seconds. Every label change also starts a run that the job `if` skips immediately (two skipped runs appeared); harmless, but visible in the Actions list.

## Not tested, and why

- **Branch protection on the base branch.** GitHub refused it on a private repository of a free account: `Upgrade to GitHub Pro or make this repository public to enable this feature.` (HTTP 403). So "approving and merging are human acts, enforced by the platform" could not be checked. In this pilot it was enforced only by the written confirmation in `ship`.
- **`relevo-queue.yml`, `status`, the SLA reminder, the review-event workflow, the digest.** They do not exist yet: tasks 4.2 to 4.7 are open in `tasks.md`. `templates/workflows/` holds only `relevo-go.yml` and `scripts/` has no `status.mjs`. `blocked` and `queued` issues therefore do not start by themselves; the pilot relabelled issue 2 by hand.
- **`fix`.** The review found nothing to fix.
- **`peer` and `roles` modes, reviewer selection.** Out of scope for a solo repository.

## Smaller observations

- The `queued` decision changes the label but posts no comment, so the person sees only a label. The `blocked` comment says "It starts automatically when they are", which is false until task 4.2 exists.
- `review` requires `evidence/` to be ignored by git. The sandbox had no such line; it was added to `.git/info/exclude` for the pilot. This belongs in `init` (task 5.1).
- The log audit reads the whole `logcat`. Another Flutter app was running on the device and wrote to the same log (including a notification registration token). No false rejection happened this time, but the audit should read only the process of the app under review (`--pid` or the package name), and the review should warn that the log may hold other apps' data.
- A pull request body with `Closes #<n>` does not close the issue when the base branch is not the default branch; `ship` already closes it explicitly, as designed.
- After `ship`, `dev` and `main` diverge (the squash-merge lives only on `dev`). The release pull request handles it, as documented, but a `main`-only fix (such as a workflow file) cannot be fast-forwarded into `dev`.
- Commits made by the agent are authored by the action's bot account, not by the assignee. Fine, but worth saying in the documentation.

## Proposed changes (not done here)

1. **Report workflow failures on the issue.** Add a final step with `if: always()` (or `failure()`) that checks whether the issue is still `building` or still `ready` and, if so, moves it to `qa-failed` with a comment and the run link. This removes the silent failures of F1, F2, F3 and F5.
2. **Add the private-repository path and the subscription token to the template** as selectable options, and document them in the future `init`.
3. **`init` must create the tracked OpenSpec root** (`openspec/config.yaml` and `.gitkeep` files), add `evidence/` to `.gitignore`, and offer the toolchain step for the chosen platform (tasks 5.1 and 5.4).
4. **`doctor` should check** the secret names, that the plugin repository can be cloned by the runner, that approvals are not dismissed on new commits, and warn when branch protection is unavailable (task 5.2).
5. **Post a comment when an issue is queued**, and change the `blocked` text until the re-evaluation workflow (4.2) exists.
6. **Filter the log audit by process** of the app under review.
7. **Add a guard against the subagent problem in `go`'s own gates**: if the dev agent report is missing when the skill is about to end, take the failure path (the skill now says so; a script check would make it testable).
8. Decide how to enforce human approval on repositories where rulesets are unavailable (task 5.3), since this pilot ran without them.
