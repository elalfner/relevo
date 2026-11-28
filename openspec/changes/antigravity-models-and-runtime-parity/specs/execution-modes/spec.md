# Spec Delta

## MODIFIED Requirements

### Requirement: A local run uses the same limits and tools as the cloud
`go-local.mjs <issue>` SHALL run `/relevo:go <issue>` in a separate git worktree using the selected runner (`--agent claude|antigravity`, else auto-detected from the Antigravity runtime environment, else `agent.build` in `relevo.yml`), applying the respective turn, cost or token limits from `relevo.yml` and the tool restrictions of the workflow. When running on Antigravity, `go-local.mjs` SHALL require `limits.run_max_tokens` before creating a worktree, SHALL resolve `agents.antigravity` settings (`--model` and `--effort`, omitting `--effort` on effort-suffixed slugs), SHALL write a temporary per-session `--settings <tmp>` file outside the worktree (omitting `modelProvider` when `GEMINI_API_KEY` is unset so cached subscription login works without modifying `~/.gemini/antigravity-cli/settings.json`, and cleaning it up after the run), SHALL set `RELEVO_AGENT=antigravity` in the child environment, and SHALL pass the guard only arguments the guard accepts; a run the guard refuses to start SHALL keep the worktree and print its path. It SHALL NOT warn that the cloud can also build the issue, because a local build does not start the cloud.

#### Scenario: Local build
- **WHEN** the person runs `go-local.mjs 42` on a Claude repository outside Antigravity
- **THEN** a worktree is created from the base branch, `claude -p` runs there with the limits and flags of the workflow, and on a clean end the worktree is removed

#### Scenario: Local build with Antigravity override on a Claude repository
- **WHEN** `relevo.yml` has `agent.build: claude`, `limits.run_max_cost: 5` and `limits.run_max_tokens: 2000000`, and the person runs `go-local.mjs 42 --agent antigravity` (or runs `go-local.mjs 42` inside an Antigravity runtime)
- **THEN** a worktree is created from the base branch, `agent-guard.mjs run` starts `agy` there with `limits.run_max_tokens`, `agents.antigravity` `--model`/`--effort`, `RELEVO_AGENT=antigravity`, a temporary `--settings <tmp>` (omitting `modelProvider` when `GEMINI_API_KEY` is unset) leaving `~/.gemini/antigravity-cli/settings.json` untouched, and a summary file outside the repository, and on a clean end the worktree is removed

#### Scenario: Dry run on a Claude repository with Antigravity override
- **WHEN** `relevo.yml` has `agent.build: claude` and `limits.run_max_tokens: 2000000` and the person runs `go-local.mjs 42 --agent antigravity --dry-run`
- **THEN** it prints the worktree and the `agent-guard.mjs run` command showing `--settings`, `--model` and `--effort` without creating a worktree or writing files

#### Scenario: Missing token limit on Antigravity local run
- **WHEN** `relevo.yml` has `agent.build: claude` without `limits.run_max_tokens` and the person runs `go-local.mjs 42 --agent antigravity`
- **THEN** `go-local.mjs` exits 2 before creating a worktree and tells the user to set `limits.run_max_tokens` in `relevo.yml`

#### Scenario: Local build with Antigravity
- **WHEN** `agent.build` is `antigravity` and the person runs `go-local.mjs 42`
- **THEN** a worktree is created from the base branch, `agent-guard.mjs run` starts `agy` there for `/relevo:go 42` with the turn and token limits of `relevo.yml`, `--settings <tmp>`, `--model`/`--effort`, a time limit and a summary file outside the repository, and on a clean end the worktree is removed

#### Scenario: The guard rejects the command
- **WHEN** Antigravity runs and `agent-guard.mjs` exits with its usage code
- **THEN** the run is reported as failed, the worktree is kept and its path is printed

### Requirement: The consumption of a run is shown by agent and by model
When the execution log or guard summary has them, the comment about a cloud run SHALL list for the main agent and each subagent its model, effort, turns, minutes, tokens and an estimated cost, and SHALL give the real cost of each model when available. The cost of an agent SHALL be written as an estimate. The launches of replicas SHALL NOT be in that list: they are shown apart (see "The usage comment shows the replicas apart from the rest"). The hidden marker of the comment SHALL carry the same figures under `agents` and `models`. A figure the log does not have SHALL be left out, and a log with none of these figures SHALL give the comment it gives today.

#### Scenario: A run with subagents
- **WHEN** the Claude log shows a developer and four QA lenses, each with its model and tool calls
- **THEN** the comment lists each of them with model, effort, turns, minutes and "about" its cost, and the real cost of each model

#### Scenario: An Antigravity run with subagents
- **WHEN** an `agent-guard.mjs` summary records `agents` entries with turns and tokens for `main` and each subagent (such as `relevo-dev` and QA lenses)
- **THEN** `readUsage` preserves `usage.agents`, `usageLine` lists each agent with its turns and token count in English or Spanish, and `usageMarker` / `parseUsageMarker` preserve the per-agent turns and tokens

#### Scenario: The costs add up
- **WHEN** the estimated costs of the agents of a model are added
- **THEN** they equal the real cost of that model in the log

#### Scenario: A log without the details
- **WHEN** the log has only the totals of the run
- **THEN** the comment and the marker are the same as before this requirement

#### Scenario: The marker is read by the digest
- **WHEN** the daily digest reads a marker that carries `agents` (including per-agent `tokens`) and `models`
- **THEN** it reads the totals as before and ignores the breakdown keys
