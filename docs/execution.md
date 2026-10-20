# Where `go` runs

English · [Español](execution.es.md)

`go` can build an issue in the cloud, on a person's machine, or both. There is no setting for it in `relevo.yml`: it follows from what is installed, which secret exists and one repository variable. This page explains each piece and what it means for the limits.

## The three places

- **Both** is the default: the `go` workflow is installed and a model secret exists, so a `ready` label starts a cloud build, and anyone can still run `/relevo:go <n>` on their machine.
- **Cloud only** is the same, with people choosing not to build by hand. Use it to build without anyone waiting.
- **Machines only**: `/relevo:init` does not add the `go` and queue workflows. Each person builds with their own Claude session and quota, with no model secret in the repository.

## Pause the cloud without a pull request

Set the repository variable `RELEVO_CLOUD_GO` to `off` (Settings > Secrets and variables > Actions > Variables). A `ready` label then starts nothing and the queue dispatches nothing, and the issue stays `ready` for a local run. Delete the variable, or set anything else, to resume, then apply `relevo:ready` again to each issue: the label events that were skipped are not replayed. It has to be a variable and not a file because a label event runs the workflows of the default branch, so a change to a file would need a pull request first.

If you build by hand while the cloud is on, the cloud may start the same issue as soon as you label it `ready`: pause the cloud first.

## When the cloud has no credential

A repository with the `go` workflow but no `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` does not fail. The issue stays `ready` and one comment says that the cloud is not configured, naming `/relevo:go <n>` for a local run and the two secrets for the cloud. `/relevo:doctor` warns about it.

## Two credentials

| | API key | Subscription token |
|---|---|---|
| Secret | `ANTHROPIC_API_KEY` | `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`, with all whitespace removed) |
| `limits.run_max_cost` | a real ceiling on spending | only a notional ceiling |
| Main control | the cost | `limits.run_max_turns` and a low `limits.concurrent_agents` |
| When it runs out | an error from the provider | the usage window of the account is used up |

- With a subscription the quota is shared by every run and by the interactive use of the account that owns the token, so `/relevo:init` sets `limits.concurrent_agents` to 1 for it.
- The mode is deduced from the name of the secret. If both exist, `/relevo:doctor` warns and says which one the workflow uses.
- Read the current Anthropic terms on automated use of a subscription, and the README of `claude-code-action`, before relying on a subscription token for a team. Relevo does not judge them; `/relevo:doctor` leaves a one-line reminder.

## What a cloud run reports

After each cloud run a comment gives the turns, the cost and the tokens that the agent runner's log reports (the cost is notional with a subscription). When the log does not have them nothing is posted. A run that stopped because the usage limit or the credit was reached says so and tells you to apply `ready` again later; any other failure keeps the generic comment with the link to the run.

## Building on your machine

```bash
/relevo:go 42 --local
```

It runs `scripts/go-local.mjs` of the plugin, which runs `claude -p "/relevo:go 42"` in a separate git worktree next to your repository, so your uncommitted changes do not matter, with the same turn and cost limits and the same closed tool lists as the workflow. The worktree is removed when the run ends cleanly and kept, with its path printed, when it does not. `--dry-run` shows what it would do.

`/relevo:status` lists the `ready` issues assigned to you with the command to run when the cloud is not building, and alerts about an issue that has been `building` with no activity for `limits.building_alert_hours` hours, with how to restart it.
