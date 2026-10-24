# Design

## Context

`/relevo:ship` (`skills/ship/SKILL.md`) is an agent-driven sequence of scripts: `ship-check.mjs` decides with `shipDecision` in `scripts/lib/ship.mjs`, then `scan-diff`, `archive-state`, `openspec validate`, `fix-tasks --stage after`, `openspec archive`, `check-archive`, `stage`, commit and push, a second `ship-check` with `--baseline`, the conflict recovery (`conflict-scope`), `gh pr merge --squash`, the issue close and `label-change --clear`. The agent adds two things: the written confirmation, and the answers to `confirm` items (`not-approver`, `no-ci`).

Constraints that shape the approach:
- Pushes, labels and closes made with the workflow token (`GITHUB_TOKEN`) start no workflows, except `workflow_dispatch` and `repository_dispatch`. The archive commit pushed that way has no checks, and `shipDecision` reads `statusCheckRollup` of the head only, so it reports `none` and asks for `no-ci`.
- The ruleset `init` creates (`rulesetBody` in `scripts/lib/init.mjs`) requires a pull request and an approval, does not dismiss stale approvals and does not require last-push approval. It requires no status checks. Projects may add required checks themselves.
- `issues: labeled` runs the workflow file of the default branch (`docs/pilot-findings.md`), while `relevo.yml` that matters is the base branch's.
- The other workflow templates pin `RELEVO_VERSION`, install scripts with `npm pack` of `@elalfner/relevo`, check that the scripts they need exist, and end with an `if: always()` step that reports a run that ended without an outcome.

## Goals / Non-Goals

**Goals:**
- The unattended run and the interactive command share one decision (`shipDecision`) and one set of scripts, so the rules cannot drift apart.
- The workflow YAML stays thin: setup and one orchestrating script, testable with a fake `gh` and `git` like the other scripts.
- Nothing from the pull request's branch is executed.

**Non-Goals:**
- Starting the project's CI from Relevo (`workflow_dispatch` of the project's workflows).
- Shipping several issues in one run, or ordering ships.
- Changing what the interactive command asks a person.

## Decisions

- **One orchestrating script, `ship-unattended.mjs`.** It runs the steps of the skill in order with the same scripts and libraries, and returns a single outcome (`merged`, `stopped` with reasons, `error`). The workflow only installs Node, OpenSpec and the package, checks out, and calls it. Alternative: write the sequence in YAML shell steps, as `relevo-go.yml` does for its reports. Rejected: the conflict recovery and the second check have branches that need tests, and shell in YAML has none.

- **The label path reuses `shipDecision` with two extra rules applied after it.** The invoker is `github.event.sender.login`. A `confirm` item that a person would answer becomes a stop: `not-approver` stops with "run `/relevo:ship <n>`", `no-ci` stops unless `review.ship_without_ci` is `true`. The merger rule (approver or author) is the existing one; only the "eligible but did not approve" case is refused. Alternative: accept the label from any eligible member as their confirmation. Rejected: the spec asks that person to state in writing that they did not approve, and a label cannot carry that.

- **Checks carry over by commit comparison, judged in `ship-check`.** With `--baseline <sha>` and a head that differs, `ship-check` asks GitHub to compare the two commits; when every changed file is under `openspec/` and the head's rollup is empty, it reads the baseline commit's rollup (GraphQL `object(oid:)` on `Commit.statusCheckRollup`, the same shape `checkRollup` already parses) and judges that instead. A head with any check of its own is judged as is. This lives in `ship-check`, not in the workflow, so `/relevo:ship` benefits too and there is one rule. Alternative: post a commit status on the archive commit. Rejected: writing a status under the name of a required check is a bypass.

- **Required checks are detected, not configured.** `ship-unattended` (and `doctor`) read the rules that apply to the base branch (`GET /repos/{repo}/rules/branches/{base}`, type `required_status_checks`) and the classic protection (`required_status_checks`). A 404 on protection means none. Alternative: a setting in `relevo.yml`. Rejected: it would drift from the platform's own setting.

- **The App token is created only when needed, and used for push, merge and close.** Secrets `RELEVO_SHIP_APP_ID` and `RELEVO_SHIP_APP_KEY`; the step `actions/create-github-app-token` runs when both exist, scoped to the current repository. When the base branch requires checks and the token is missing, the run stops before archiving. When the token exists but no checks are required, it is still used, so the merge into the base branch starts the project's push workflows (CI on `dev`, deploys). The orchestrator receives two tokens: the workflow token for reads, comments and labels, and the push token (App or workflow) for `git push`, `gh pr merge` and the close.

- **Waiting for checks is bounded.** After an App push, the run waits with `gh pr checks --watch` under a 30-minute limit (job limit 45). On timeout it stops without merging; because the change is already archived, applying the label again goes straight to the second check and the merge (`archive-state` returns `archived`).

- **The merge is pinned to the checked head.** `gh pr merge --squash --match-head-commit <head the second check judged>`, so a push that lands between the check and the merge makes GitHub refuse it, and the run reports that instead of merging unchecked code.

- **Configuration from the base branch.** The workflow checks out the default branch (it holds the workflow and a `relevo.yml` that names `branches.base`), then fetches the base branch and reads `relevo.yml` with `git show origin/<base>:relevo.yml` into the runner's temp folder. The feature branch is checked out into a separate folder, used only for `git` and `openspec` on Markdown. No package install, no script and no hook from it runs (`git` is run with `core.hooksPath=/dev/null`).

- **The label is an overlay.** `LABELS` gains `{ key: 'ship', kind: 'overlay' }`, so transitions never treat it as a state and `label-change --clear` removes it with the rest. The final `if: always()` step removes it and comments with the log link when the label is still there, the same pattern as `relevo-go.yml`.

- **The queue is dispatched after the close.** `gh workflow run relevo-queue.yml` with the workflow token (dispatch is allowed); a missing queue workflow is ignored. With the App token the close already starts it, and the dispatch is skipped.

- **The approval message checks for the workflow.** `review-event` looks up `.github/workflows/relevo-ship.yml` on the default branch through the API; when it exists, the approval comment names the label as well as the command; on any error it names only the command.

- **Messages go through `render-message`.** New kinds in `scripts/lib/messages.mjs`, in English and Spanish: `ship_stopped`, `ship_done`, `ship_needs_app`, `ship_no_ci`, `ship_not_approver`, `ship_failed`.

## Risks / Trade-offs

- [The archive commit is merged with no check of its own when no App is used] → `check-archive` and the comparison both prove it changes only `openspec/`, and `openspec validate` runs on it in the same run; the comment of a merge without checks on the archive commit says the checks of the approved head were used.
- [A merge made with the workflow token starts no push workflows on the base branch, so CI or deploys on `dev` do not run] → the App token is used whenever it exists; `docs/execution.md` says to set it up when the project relies on push workflows on the base branch.
- [A person who can label but is not eligible spams runs] → each run is light (no model, no toolchain), concurrency is one per issue, and the decision stops before any write.
- [The workflow only works once it is on the default branch] → `doctor` already judges workflows on the default branch and reports one that exists only locally.
- [An App key is a long-lived secret] → it is scoped by the App's installation to one repository with contents, pull requests and issues permissions; the docs say not to add the App to any ruleset bypass list.
- [GitHub refuses the merge for a reason the decision did not foresee] → the run reports GitHub's message and stops, never retrying with an override.

## Migration Plan

- Released in the next minor version. Existing projects run `/relevo:init` to get the label and the template (it reports existing workflows as different and leaves them), then promote the template to the default branch.
- Repositories with required checks create the App and the two secrets; `doctor` tells them.
- Rollback: delete the workflow or set `RELEVO_CLOUD_SHIP` to `off`; `/relevo:ship` is unchanged except for the checks carried over, which only removes a needless `no-ci` question.
