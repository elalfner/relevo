# Proposal

## Why

Relevo is meant to be used by other people, who will not all build the way the pilot did. Some want `go` in the cloud with a Console API key, some with a Claude subscription token, some on their own machine with their own session, and most want to be able to switch without a pull request. Today the template builds in the cloud or not at all: there is no switch that takes effect at once (the labelling event runs the workflow of the default branch, so any change to a workflow has to reach `main`), a repository without a model credential fails at the build instead of saying what to do, a usage-limit failure looks like a code failure, the consumption of a run is invisible, and there is no supported way to run `go` on one's own machine: the unattended agent's closed tool list, its limits and a clean working tree are things only the workflow knows.

Facts read in the code: the `go` workflow's `decide` job has no condition on a repository variable and no check that a credential exists; `go-plan.mjs` turns a `start` decision into a claim unconditionally; the final step of the build job reports every failure with the same text; `status` has no row for `ready` issues assigned to the person and no alert for an issue stuck on `building`; the limits of the run (`--max-turns`, `--max-budget-usd`, the tool lists) are written twice, in the workflow and in `relevo.yml`, and a test keeps them equal. `anthropics/claude-code-action` exposes the path of its execution log as the output `execution_file` (read in its `action.yml`); the format of that file is not documented.

## What Changes

- **One switch, no new setting.** Where `go` builds is decided by three things already in the repository: the workflow files that are installed, the model credential that exists as a secret, and the repository variable `RELEVO_CLOUD_GO`. With the value `off` a `ready` label starts nothing and the queue dispatches nothing, and changing the variable needs no pull request.
- **A cloud without a credential does not fail.** The `decide` job notices that neither `ANTHROPIC_API_KEY` nor `CLAUDE_CODE_OAUTH_TOKEN` exists, leaves the issue `ready`, and comments that the cloud is not configured and that the person can run `/relevo:go <n>` on their machine.
- **Two credentials.** `doctor` deduces the credential mode from the secret name (`api_key` or `subscription`), warns when both exist, prints a one-line reminder to read the current Anthropic policy for automated use of a subscription, shows the state of `RELEVO_CLOUD_GO`, and warns when a subscription is combined with more than one concurrent agent (the quota is shared). `init` asks where `go` runs and which credential it will use, writes `limits.concurrent_agents` accordingly, and generates the workflow with the right credential line (or no `go` and queue workflows for a local-only setup).
- **A usage-limit failure says so.** The final step of the build job tells a usage-limit or credit failure apart from a code failure and says to label the issue `ready` again later.
- **Consumption is visible.** After each cloud run a short comment gives the turns, the cost (notional with a subscription) and the tokens, read from the action's execution log; when the log has none of them nothing is posted.
- **Local mode.** A new command `go-local.mjs <issue>` runs `go` on the person's machine: in a separate `git worktree`, with the same turn and cost limits and the same closed tool lists as the workflow (one shared function writes them for both), and removes the worktree when the run ends cleanly.
- **`status`.** The person sees the `ready` issues assigned to them with the command to run when the cloud is not building, and an alert for an issue on `building` with no activity for `limits.building_alert_hours` hours, with the way to restart it.

## Capabilities

### New Capabilities

- `execution-modes`: where builds run, the switch, the reserve, the credentials, the usage-limit message, the consumption comment and the local run.

### Modified Capabilities

- `configuration`: the `limits.building_alert_hours` setting.
- `go`: the decision when there is no credential; the run limits written once.
- `init-doctor`: the credential mode, the variable, the reminder, and the questions of `init`.
- `status`: the rows for `ready` issues and the alert for a stuck build.

## Impact

- Code: `scripts/lib/run-flags.mjs` (new), `scripts/go-local.mjs` and `scripts/lib/go-local.mjs` (new), `scripts/run-usage.mjs` and `scripts/lib/run-usage.mjs` (new), `scripts/usage-limit.mjs` (new), `scripts/go-plan.mjs`, `scripts/lib/plan.mjs` or its caller, `scripts/lib/messages.mjs`, `scripts/lib/config.mjs`, `scripts/lib/doctor.mjs`, `scripts/lib/init.mjs`, `scripts/lib/status.mjs`, `scripts/lib/status-data.mjs`.
- Content: `templates/workflows/relevo-go.yml`, `relevo-queue.yml`, `templates/relevo.yml`, `skills/init`, `skills/doctor`, `skills/status`, `skills/go`, `docs/` (a page on where `go` runs, EN and ES), `docs/action-parameters.md`.
- Not changed: the queue commenting that an issue is eligible (the person sees it in `status`), a per-issue label to force local, automatic retry after a usage limit, the daily digest with consumption.
