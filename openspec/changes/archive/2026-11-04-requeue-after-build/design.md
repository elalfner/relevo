# Design

## Context

Labels are set in `build` by the agent and by the report steps, all with `github.token`. `workflow_dispatch` is the exception GitHub allows for that token, and `relevo-queue.yml` already declares it plus a `relevo-queue` concurrency group (`cancel-in-progress: false`), so repeated dispatches collapse. `requeue.mjs` counts slots from labels (`building`), not from running workflow runs, so dispatching while the build job is still finishing is safe once the labels are set. `relevo-ship.yml` and `ship-unattended.mjs` already dispatch the queue this way. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A freed slot re-evaluates the queue within seconds, in every ending of a build.
- No new permission for the token the agent can use.

**Non-Goals:**
- Changing `requeue.mjs` or the queue rules.
- Covering runs outside `relevo-go` (ship already does its own).

## Decisions

1. **A separate job `requeue`, not a step in `build`.** Job permissions apply to all its steps, and the agent has `Bash` with `GH_TOKEN` set to the job token; issue text is untrusted. `actions: write` there would let an injected prompt dispatch or cancel workflows. A job of its own with `actions: write` only (no `contents`, `issues`, `pull-requests`) runs no agent and needs no checkout. Alternative: a step in `build` (simpler, wider token). Alternative: `workflow_run` in the queue (no permission, but fires on every go run, including no-ops, and can loop if gates and queue disagree).
2. **Condition.** `needs: [decide, build]`, `if: always() && (needs.build.result != 'skipped' || needs.decide.result == 'failure') && vars.RELEVO_CLOUD_GO != 'off'`. A build that ran frees its slot in any result, cancelled included. A decide failure may have left a claimed issue as `qa-failed`. Other decisions free nothing, which also keeps a go/queue disagreement from looping.
3. **Command.** `gh workflow run relevo-queue.yml --repo "$GITHUB_REPOSITORY"` with `GH_TOKEN: ${{ github.token }}`, `continue-on-error: true`, and a `::warning::` when it fails (missing file, no `actions: write`). Same tolerance as `ship-unattended.mjs`.
4. **Runner and pause.** `runs-on: ubuntu-latest` like the others, so `init` rewrites it for self-hosted runners; `RELEVO_CLOUD_GO=off` is honored as in `decide`.
5. **Version.** Template header, `RELEVO_VERSION` in go and queue, and `plugin.json` move to 0.14.3; the CHANGELOG entry is added on `dev` first.

## Risks / Trade-offs

- [Repos with `actions: read` as the default workflow permission] → the job declares its own `actions: write`; the warning on failure tells the cause and the cron still backstops.
- [An older `relevo-go.yml` stays in repos] → `/relevo:init` reports the older `relevo-template`; the workaround stays documented.
- [An extra job costs a few seconds of runner time] → accepted for the separate token.
