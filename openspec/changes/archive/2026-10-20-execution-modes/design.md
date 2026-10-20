## Context

See `proposal.md`. Constraints that shape the design:

- A label event runs the workflow file of the default branch, so a switch that needs a pull request is slow; a repository variable (`vars.RELEVO_CLOUD_GO`) is read at run time and can be changed from the settings.
- A workflow can test whether a secret is set only through an expression (`secrets.X != ''`), and never see its value in a step condition it is not mapped to.
- The `go` skill already handles a hand-run (no `--decision`): it plans, claims and builds with the person's own `gh` and `git`. What is missing locally is the closed tool list, the limits and a clean tree.
- `claude-code-action` gives the path of its execution log (`execution_file`); its content is not documented. The log of a `claude -p` session in JSON form ends with a `result` entry that carries `num_turns`, `total_cost_usd` and `usage`, but that was not verified here.

## Goals / Non-Goals

**Goals:** a switch with no pull request, a clear message instead of a failure when the cloud cannot run, two supported credentials, visible consumption, a local run that is as restricted as the cloud one.

**Non-Goals:** a per-issue label to force local, automatic retry after a usage limit, a queue that comments on eligible issues, aggregating consumption in the daily digest, judging Anthropic's policy on subscriptions.

## Decisions

**D1. No setting in `relevo.yml`.** The mode is derived (installed workflow files, secret names, the variable), so there is one source of truth per thing and a repository cannot say one thing in `relevo.yml` and another in its secrets. `init` decides which workflow files exist; `doctor` explains the result.

**D2. The variable is read in the `if` of the jobs.** `decide` and the queue job get `vars.RELEVO_CLOUD_GO != 'off'`. A skipped job leaves the issue `ready`, which is what a local run needs. Alternative: a file in the repository: needs a pull request, the thing the variable avoids.

**D3. The credential check is an expression mapped to an environment variable.** The `decide` step gets `HAS_CREDENTIAL: ${{ secrets.ANTHROPIC_API_KEY != '' || secrets.CLAUDE_CODE_OAUTH_TOKEN != '' }}` and passes `--credential "$HAS_CREDENTIAL"` to `go-plan.mjs`. With `false`, a `start` decision becomes `{ action: 'local', comment: cloud_not_configured }`, with no label change and no claim; the output `action` is `local`, which is not `start`, so the build job is skipped. The comment is posted when the label is applied (one event, one comment); the queue never acts on `ready` issues, so it does not repeat it.

**D4. Usage-limit detection is a heuristic, and says so.** `scripts/usage-limit.mjs --file <execution_file>` exits 0 when the log contains text that Claude Code prints when a usage limit, a quota or a credit balance is reached (`usage limit`, `rate limit`, `credit balance is too low`, `quota`). The patterns come from the messages the CLI and the API document, not from a failed run seen here; the findings page records that they are unverified until a real one is seen. A wrong guess only changes the wording of a comment on a failed run.

**D5. Consumption is read tolerantly.** `scripts/lib/run-usage.mjs` accepts a JSON array or JSON lines, takes the last entry whose `type` is `result` (or the last with `num_turns`), and reads `num_turns`, `total_cost_usd` and `usage.input_tokens` plus `usage.output_tokens` when present. Nothing found, nothing printed, exit 0: the step must never fail a run. The comment says the cost is notional when the secret in use is the subscription token (the step receives which one exists through its own `HAS_*` expressions).

**D6. Shared flags.** `scripts/lib/run-flags.mjs` exports `ALLOWED_TOOLS`, `DISALLOWED_TOOLS` and `runFlags(config)`; `go-local.mjs` uses it and a test reads the `claude_args` of the template and compares. The template keeps literal values (it is a file people copy), the test is what keeps them from drifting.

**D7. The worktree.** `go-local.mjs` runs `git worktree add --detach <parent of the repository>/.relevo-worktrees/<repository>-<issue> origin/<base>`, runs `claude -p` there with `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, and on exit code 0 runs `git worktree remove --force` on it. The `go` skill creates the feature branch itself inside the worktree. A failure keeps the worktree and prints its path. All process and git calls go through an injected runner so the module is tested without `claude`.

**D8. Is the cloud building?** `status` and `go-local.mjs` need the same answer: the workflow `relevo-go.yml` exists on the default branch and the variable is not `off`. One function, `cloudBuilds({ workflowPresent, variable })`, in `scripts/lib/execution-mode.mjs`, with the GitHub reads in the callers.

**D9. Credential mode in `init`.** The two credential lines already exist in the template, one commented. `init` flips them with a text transformation of the template (`credentialLine`), tested on the template itself so a change to the template that breaks the transformation fails a test.

## Risks / Trade-offs

- [The execution log has another shape] → the parser finds nothing and posts nothing; the sandbox run (a task) records the real shape and the parser is adjusted then.
- [The detection of a usage limit matches too much] → the only effect is the wording of a comment on an already failed run.
- [A person runs `go` locally while the cloud also starts it] → `go-local.mjs` warns, and the claim step of `go` makes the second one stop (the issue is no longer `ready`); `RELEVO_CLOUD_GO=off` removes the race.
- [`concurrent_agents` 1 for a subscription slows a team] → it is a recommendation `init` writes and `doctor` explains; the number can be raised.

## Migration Plan

Nothing changes for a repository that does nothing: both, API key, no variable. Copy the workflows again to get the variable guard, the credential check and the consumption and usage-limit steps. Rollback: copy the previous templates back.

## Open Questions

- The exact format of the execution log and of a usage-limit failure, to be recorded from the sandbox (a task).
