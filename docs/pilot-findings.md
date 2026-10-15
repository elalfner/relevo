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

---

# Second pilot: the full cycle with the queue, one person (task 4.8, partial)

Date: 2026-10-14 and 2026-10-15. Repository: the same sandbox, now public, with `review.mode: none`, one person, `built_unreviewed_per_person: 1`, a milestone with a due date. The plugin was installed the way another person would install it (`claude plugin marketplace add`, `claude plugin install`). Setup was done with `init` and checked with `doctor`.

## Verdict

Four issues went from `ready` to merged, two of them started by the queue and not by a person: #2 was reviewed and shipped; #4 sat `queued` while #2 was waiting, started by itself once #2 merged (after the fixes below), was built, reviewed and shipped; #3 came back `needs-spec`, was corrected, queued, started by the queue, built, reviewed and shipped. #5 was not started because it has no assignee, and said so in a comment. Two `dev` → `main` promotions were done with merge commits. `status` showed "Nothing is waiting on you" at the end.

Not tested, because it needs a second person: approval and merge by someone other than the author, `peer` and `roles` modes, the review reminder and escalation, the review-event workflow, reviewer selection and `needs-reviewer`. They are covered by unit tests only. Task 4.8 stays open for that reason.

## What `init` and `doctor` found and did on a real repository

- `doctor` run against the sandbox listed exactly what was missing (three skills, the workflows, `evidence/` in `.gitignore`, the model secret, a CI workflow) and went "All green" after the setup.
- `init apply` created labels, workflows and the ignore line, and two rulesets after the files were pushed.
- A second `init plan` still offered to turn on secret scanning and to ask for the credential although both existed: fixed, `init` now recognises them.
- Rulesets stop everyone, the owner included, from pushing to the base and release branches. A workflow only runs from the default branch. So the files must be pushed first and the rules applied after: `init apply --skip protection,push-scope`, then `init apply` again.
- Secret scanning was reported as set by `init` but read back as disabled once; repeating the same call enabled it. Cause unknown (possibly a delay). `doctor` now reads it back.

## What failed, with the exact error

### G1. The queue, review, SLA and digest workflows could not clone the plugin (blocking)

```
remote: Repository not found.
fatal: repository 'https://github.com/<owner>/relevo/' not found
```

Those four workflows check out the plugin repository for its scripts with the default token, which cannot read another private repository. This is F1 of the first pilot again, in four more files. Fixed: they pass `token: ${{ secrets.RELEVO_PLUGIN_TOKEN || github.token }}`. `doctor` now fails when a workflow checks out a private plugin repository without a token.

### G2. The agent runner refuses a build started by the queue (blocking)

```
Action failed with error: Workflow initiated by non-human actor: github-actions (type: Bot).
Add bot to allowed_bots list or use '*' to allow all bots.
```

The queue starts builds with `gh workflow run`, so the actor is the Actions bot. The build failed after 44 seconds, before it claimed the issue, so the issue stayed `queued` and the queue would have dispatched it again every 30 minutes. Fixed: `allowed_bots: github-actions` (that bot only, never `*`), and the final report step also moves an issue left `queued` by a failed job to `qa-failed`.

### G3. Which branch a workflow runs from

Workflows started by `issues` events, schedules and `workflow_dispatch` run the file on the **default branch**; workflows started by `pull_request` run the file on the **pull request's base branch**. A fix merged only into `dev` repaired `relevo-review` but not the queue. Every workflow change has to reach `main` and `dev`; with squash merges `dev` and `main` diverge, so promotions use merge commits.

### G4. `doctor` reported a false failure

Once, `doctor` said `dev` and `main` did not require a pull request while both rulesets were active; a second run passed. A failed read of the rulesets was being treated as "not protected". Fixed: a failed read is a warning. It also confused a `plugin_marketplaces` URL that carries a token with an unreachable one. Open: `doctor` reads the workflows in the working copy, not the ones on the default branch, so it did not notice that `main` still had the old files.

### G5. Two builds were dispatched for the same issue (open)

When #3 was relabelled, two queue runs started (one per label event), 15 seconds apart. Both decided `{"start":[3]}` and each dispatched `relevo-go` for #3. The queue only decides; the issue becomes `building` several minutes later, when the build job has installed Flutter and OpenSpec and reaches `go-plan --claim`. The second queue run therefore still saw #3 as `queued`. The per-issue concurrency group made the second build wait for the first and then finish quickly (it found the issue already built), so nothing was built twice, but it cost a runner start and about a minute of Actions time. Options: the queue marks the issue `building` when it dispatches (then `go` must accept a dispatched issue that is already `building`), or the queue checks for a `relevo-go` run already queued or in progress. Not done.

## Times

| Run | Outcome | Time |
|---|---|---|
| Queue evaluation | decision and dispatch | about 15 seconds |
| Build of #4, started by the queue | `built` | about 4 min 40 s |
| Build of #3, started by the queue | `built` | about 3 min 40 s |
| Duplicate build of #3 (G5) | ended quickly, issue already built | about 1 min of work after waiting 3 min |
| Run that does not build (label change, no `ready`) | skipped | 1 to 3 seconds |
| `go` run that did not start a build after the setup steps | no build | about 1 min |

Every label change starts two queue runs (the label is removed and another is added); both finish in seconds. No cost per run was read from the logs this time.

## Smaller observations

- The runner's setup (Flutter, OpenSpec, plugin) dominates the time of a run that does not build. A light first job that only decides, and a heavy second job that builds only on `start`, would remove that cost; not done.
- A queue run triggered by a closed issue or a label change evaluates all candidates, so one build can follow another label event within seconds.
- `relevo-go` `skipped` runs are expected: the job `if` rejects every label that is not `relevo:ready`.
- The `evidence/` folder stays on the person's machine with the `attach_to_pr` policy; the person decides whether to drag the screenshots into the pull request.
- Promoting `dev` to `main` is a separate pull request, as designed; `ship` does not do it.
- A repository that has rulesets and is public makes `trust: public` the right setting, but that requires a review mode other than `none`, so a one-person pilot keeps `trust: private-team` and is only safe while one person has write access.

## Proposed changes (not done here)

1. Make `doctor` read the workflow files from the default branch on GitHub.
2. Remove the duplicate dispatch (G5).
3. Split `relevo-go.yml` into a light job that runs the gates and a heavy job that builds only when the decision is `start`.
4. Re-run this pilot with a second person to cover the untested parts.
