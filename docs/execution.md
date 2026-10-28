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

## What the build installs

The agent of the build loads the Relevo plugin from the package that the job unpacks at the version `RELEVO_VERSION` pins (`--plugin-dir` in `claude_args`), not from a marketplace: one pin decides the scripts and the skills, nothing is cloned from the plugin repository, and a private plugin repository needs no `RELEVO_PLUGIN_TOKEN`. A workflow copied from an older version still adds the marketplace; `/relevo:init` updates it. The build job of the go workflow installs the toolchain of the stack of the platform of the issue, so that the agent and QA can run the checks of your project: Flutter with `subosito/flutter-action` and PHP with Composer for Laravel with `shivammathur/setup-php`. Each step is guarded by the stack, so only the one for the issue runs. Vue needs only Node, which the job already has. Change the versions and the caching in `relevo-go.yml` to suit the project. Installing the dependencies is yours to add (`npm ci --ignore-scripts`, `composer install --no-scripts`), because the package manager and the lockfile vary. `/relevo:doctor` fails when a Flutter or Laravel platform has no active step, because every cloud build would then fail QA after spending the run. As a second guard, the build job checks, right before the agent starts, that every tool the profile of the platform lists (`flutter`; `php` and `composer`) is on the path of the runner. If one is missing, no model turn is spent: the issue becomes `relevo:qa-failed` with a comment that names the missing tools and says to enable the toolchain step and to apply `ready` again after removing `qa-failed`.

## Self-hosted runners

The Relevo workflows run on `ubuntu-latest` unless `relevo.yml` names another runner. To use your own, list its labels:

```yaml
runner:
  labels: [self-hosted, linux-build]
```

`/relevo:init` asks whether you use a self-hosted runner and writes the labels into `relevo.yml` and into every `runs-on` of the workflows it adds. `runs-on` is read before any step runs, so a workflow cannot read `relevo.yml` itself: the file and the workflows have to agree, and `/relevo:doctor` fails and names the file when they do not (for example after you edited a workflow by hand, or when the ship workflow comes from a newer template). To change the runner later, change `runner.labels` and each `runs-on`.

What Relevo assumes of the runner:

- **It has `git`, `gh` and `jq`.** GitHub's images have them and yours may not. The build job checks them with the tools of the stack, and a runner that lacks one stops before the agent, without a model turn, with a comment on the issue that names the tool. Node is installed by the job.
- **It keeps its files between jobs.** Relevo never asks whether the runner is ephemeral, because it cannot check the answer. Each job installs OpenSpec under the temporary folder of the job at the version in `OPENSPEC_VERSION`, not globally; the Antigravity run keeps its binary, plugin and settings in a home folder of the job; and a last step, which runs even when the job fails, removes what the job added to the workspace. It does not clean the rest of the workspace, because your own jobs may rely on its caches.
- **Toolchains are yours to provide.** On a self-hosted runner you can keep the Flutter or PHP steps of `relevo-go.yml` (they install the toolchain per job) or preinstall the SDKs on the machine and comment the steps out; the toolchain check of the build job passes either way as long as the tools are on the path. `/relevo:doctor` cannot see an SDK on the machine, so with the step commented out it still reports that the go workflow installs no toolchain; that failure can be ignored in this case, so keep a note of why the step is off.
- **Antigravity needs x86-64 Linux.** The pinned binary is `linux-x64`.

A runner with `limits.concurrent_agents: 1` is the same machine that runs your pull request checks, so a build of up to 60 minutes holds them up. Add runners with the same labels rather than raising the limit.

The agent's code runs with the permissions of the runner's user, which on your own machine can reach your network. An ephemeral runner, or a container, is the barrier; see [Security](security.md#what-it-does-not-protect). Checked on one self-hosted runner: `$RUNNER_TEMP` is emptied between jobs, but `claude-code-action` keeps its state in the home of the runner's user (settings, caches and the transcripts of its sessions under `~/.claude/projects`), which Relevo does not remove; clean it yourself if the transcripts, which hold what the agent read and wrote, should not stay.

## What a cloud run reports

After each cloud run a comment gives the turns, the cost and the tokens that the agent runner's log reports (the cost is notional with a subscription). When the log does not have them nothing is posted. A run that stopped because the usage limit or the credit was reached says so and tells you to apply `ready` again later; any other failure keeps the generic comment with the link to the run.

The same comment holds a hidden marker with those figures, which the daily digest adds up: it ends with a line such as `Usage, last 7 days: 3 runs, 35 turns, about $3.75, 1,350 tokens.` and says when the cost is notional (for all the runs, or `notional for 1 of 2 runs`). Only the runs of the last seven days that left a marker are counted. Runs made before your project raised `RELEVO_VERSION` to the release that writes the marker have none and are not counted, and the figures are never guessed from the text of the comment, so the line fills in during the first week. The digest still posts nothing when nobody is waiting, whatever the usage.

## How long each stage takes

The digest ends with one line that tells where the time of an issue goes: the median of each stage that finished in the last seven days, and in brackets how many finished. The five stages follow the labels of the lifecycle:

| Stage in the line | From | To |
|---|---|---|
| gate | `relevo:ready` (or `relevo:queued`) | `relevo:building` |
| build | `relevo:building` | `relevo:built` |
| waiting for you | `relevo:built` | `relevo:in-review` |
| device review | `relevo:in-review` | `relevo:pr-open` |
| peer review | `relevo:pr-open` | the issue closed as completed |

- **Only the normal path counts.** A build that QA rejects, an issue sent back to the spec writer, a block or a request for changes is not a stage, and the days spent there are not part of any of them. An issue built again after a failure adds the build that worked.
- **A stage with no sample is not in the line.** In a solo review the stages are skipped and there is nothing to show; a digest with no stage at all has no such line, and it is still not posted when nobody is waiting.
- **A stage counts in the week it finished**, however long it lasted: a review that began nine days ago and finished two days ago counts with its whole length.
- **Nothing is stored for it.** The times are read from the events that GitHub keeps for the issues, newest first and until the end of the week, and then from the events of each issue that finished a stage. A read that fails leaves the digest without the line. A project gets the line when it raises `RELEVO_VERSION` in `relevo-digest.yml` to the release that has it.

## Following a cloud run

While a cloud build runs, one comment on the issue shows how far it is. It is edited in place, never added to, and looks like this:

```text
Relevo build in progress: QA (attempt 2 of 3)
Tasks: 6 of 9
Running for 7 min
```

- **The phase** is planning, specification, development, QA or delivery. The `go` skill announces it when it enters each step, with the attempt number out of the allowed retries (`qa_retries`) when QA rejects the work and development starts again. If it announces nothing, the phase is deduced from the working tree, which cannot tell QA from a new attempt of development.
- **The tasks** are the checked boxes of `tasks.md` out of all of them. The workflow counts them itself every 30 seconds, so they do not depend on the agent.
- **The minutes** are whole minutes since the run started. A run whose minutes keep growing while its tasks and phase stay the same is stuck, or in a long step: open the run to read its log. The comment is edited only when its text changes, about once a minute.
- **When the run ends**, whatever the outcome, the comment is replaced by one line that points to the result (or, for a run that left none, says so) and links the run. The result itself is the comment that was always posted.

It shows the phase and the attempt, not what a subagent is doing inside them. A local run (`go --local`) has no such comment: you are watching the session. To get it in a project that already has the workflow, take the new `relevo-go.yml` through `/relevo:init`, which merges it with your changes, and raise `RELEVO_VERSION`; until then the runs build as before without it. The report never fails a run: if GitHub refuses an edit, the build goes on.

## Building on your machine

```bash
/relevo:go 42 --local
```

It runs `scripts/go-local.mjs` of the plugin, which runs `claude -p "/relevo:go 42"` (or `agy -p` when `agent.build: antigravity`) in a separate git worktree next to your repository, so your uncommitted changes do not matter, with the same turn and cost limits and the same closed tool lists as the workflow. The worktree is removed when the run ends cleanly and kept, with its path printed, when it does not. `--dry-run` shows what it would do.

In a Claude Code session, running `/relevo:go <issue>` without `--local` builds in a worktree of its own too, so you can run two at once and keep working in your checkout. The skill makes it with `scripts/go-worktree.mjs` (next to your repository, in `.relevo-worktrees/`, from `origin/<base>`, the same place as `--local`), enters it, and builds there; you see the build in your session. When the issue ends `built`, or a gate stops it before anything is built, the worktree is removed; after a failed run it stays and its path is printed. If the worktree of that issue already exists (another run is building it, or a failed one left it) the run stops and tells you the command that removes it. Inside a worktree that already exists, such as one made by `--local`, it builds where it is. Use `--local` when you want the build in its own process with the closed tool lists of the workflow. `/relevo:review` still runs in your main checkout.

In Antigravity interactive chat sessions, running `/relevo:go <issue>` automatically runs the build inside an isolated subagent with `Workspace: 'share'`. This creates an ephemeral worktree automatically, allowing multiple chat tabs to build different issues concurrently without branch or OpenSpec collisions. The main repository root remains clean on the base branch, reserved for the developer and interactive `/relevo:review` sessions with connected devices. Upon opening a pull request, `review` restores the root workspace to the base branch, only in the main checkout and only when no other worktree holds that branch; it never fails the review for it.

`/relevo:status` lists the `ready` issues assigned to you with the command to run when the cloud is not building, and alerts about an issue that has been `building` with no activity for `limits.building_alert_hours` hours, with how to restart it.

## With Antigravity

`agent.build: antigravity` makes the cloud build run `agy` instead of `claude-code-action`; the rest of the workflow, the gates and the reports are the same file. The secret is `GEMINI_API_KEY`, and the limit is `limits.run_max_tokens` instead of `limits.run_max_cost`, because Antigravity has no cost limit: a run guard that Relevo starts around the agent enforces the turn and token limits of `relevo.yml`, and the quota of the Google Cloud project that owns the key is the ceiling that really holds. What it can and cannot enforce is in [Security](security.md#which-agent-builds). `/relevo:init` asks which agent builds and writes the workflow and `relevo.yml` for it. This path has been tested on the text of the workflow, with a fake agent and on the commands of the real CLI, not yet on a real runner.

## Shipping with a label

`relevo-ship.yml` ships an approved issue when a person applies the label `relevo:ship` to it, with the same checks as `/relevo:ship` and no model, so it needs no model credential and no local copy. `/relevo:init` adds it in every setup, also when `go` runs only on machines. Like the other workflows it runs from the default branch, so it works once it is there: GitHub runs the workflows of an `issues` event only from that branch, so a copy on `dev` does nothing while `main` is the default. On a private repository on the free plan, where GitHub offers no branch rules, it counts the base branch as requiring no checks; a repository with no CI at all still needs `review.ship_without_ci: true`. The repository variable `RELEVO_CLOUD_SHIP` set to `off` pauses it: the label then does nothing until you delete the variable and apply the label again.

**The checks of the archive commit.** Shipping commits the archived specification to the branch and pushes it before the merge. A push made with the workflow's own token starts no workflow, so that commit gets no checks of its own. Because it changes only `openspec/`, the checks of the approved head count for it, and the comment after the merge says so. The same rule applies to `/relevo:ship`.

**When the base branch requires checks.** Then GitHub refuses to merge a commit without them, and the run stops before archiving, naming what is missing. Set up a GitHub App once:

1. Create a GitHub App owned by your account or organization (Settings > Developer settings > GitHub Apps), with no webhook, and the repository permissions Contents, Pull requests and Issues set to read and write.
2. Install it on this repository only.
3. Store its App ID as the repository secret `RELEVO_SHIP_APP_ID` and a private key it generated as `RELEVO_SHIP_APP_KEY`.
4. Do not add the App to any ruleset's bypass list: it must follow the same rules as everyone.

With the App, the run pushes, merges and closes with the App's token, so your CI runs on the archive commit, and the run waits up to 30 minutes for it. If the checks take longer, the run stops without merging, and applying the label again resumes from the merge. The App is also worth it when you rely on workflows that run on pushes to the base branch, because a merge made with the workflow's token starts none. `/relevo:doctor` says whether the App is needed and whether its secrets exist.

**No checks at all.** If no check ran on the approved code, the label stops, because only the review vouches for it and a label cannot confirm that. Run `/relevo:ship <n>`, which asks you, or set `review.ship_without_ci: true` in `relevo.yml`.
