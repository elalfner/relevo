# Proposal

## Why

Teams that use both Claude Code and Antigravity currently cannot declare limits or model settings for both tools in one `relevo.yml` (`limits.run_max_cost` and `limits.run_max_tokens` mutually reject each other, and `agents.*` has only one Claude-centric block), cannot run `/relevo:go <n> --local` on Antigravity when Claude quota runs out without editing `relevo.yml`, and Antigravity local/cloud runs still use `agy 1.4.4` without `--model`/`--effort`, isolated per-session `--settings`, per-subagent usage reporting, or Gemini quota-limit retry detection. Completing Issue #232 (grounded in the `agy 1.5.18` empirical spike from #231) adds Gemini 4 model selection, full Claude Code + Antigravity coexistence, and `agy 1.5.18+` local and cloud runtime parity.

## What Changes

- **Claude Code + Antigravity coexistence in `relevo.yml` (`scripts/lib/config.mjs`, `templates/relevo.yml`)**:
  - Allow both `limits.run_max_cost` and `limits.run_max_tokens` to coexist in `relevo.yml`: keep the active `agent.build` limit mandatory, and validate the inactive limit's type and range without error when present.
  - Add optional `agents.main` (`{ model, effort }`) and optional tool-scoped `agents.claude` and `agents.antigravity` blocks (each supporting `main`, `ladder`, `dev`, `qa.*`), alongside backward-compatible top-level `agents.*`. Validate all present blocks and resolve the active tool's settings (tool block → top-level `agents.*` → tool defaults).
  - Define Antigravity defaults grounded in the #231 spike: `main: { model: gemini-4-neon, effort: high }`, `ladder: [flash_lite, flash, pro, inherit]`, `dev` and all five QA lenses (`spec`, `security`, `code`, `interface`, `bugs`) defaulting to `inherit`, and QA `auto` floor `inherit`, so no subagent silently downgrades to `gemini-4-hydrogen-*`.
  - Under `depth: prototype` for Antigravity, lower `agents.main.effort` to `medium` while keeping `dev` and all five QA lenses on `inherit`.
  - Replace blanket "all `agents.*` are ignored" warnings for Antigravity with targeted warnings in validation, `doctor`, and `init` only for unapplied fields: per-subagent `effort`, non-tier subagent models, and `agents.main` effort-suffix conflicts.
  - Keep `trust: public` rejected with `agent.build: antigravity`.
- **Tool-aware model planning and Antigravity subagent tier launches (`scripts/lib/model-plan.mjs`, `scripts/model-plan.mjs`, `scripts/lib/adapters/antigravity.mjs`)**:
  - Resolve `model-plan.mjs` against the active runtime agent (`--agent` / `RELEVO_AGENT` / `config.agent.build`) and its tool-specific defaults and ladder so `auto` scoring, clamping, `configPlan` fallback, and `escalate` work cleanly on Antigravity's `[flash_lite, flash, pro, inherit]` ladder.
  - Update Antigravity-rendered `go/SKILL.md`, `qa-run.md`, `fix/SKILL.md`, and `review/SKILL.md` to pass planned native `invoke_subagent` `Model` tiers (`flash_lite`, `flash`, `pro`, `inherit`, never `effort`) on subagent launches and pass `--agent antigravity` for `/relevo:go <n> --local`.
- **Antigravity run guard and per-session `--settings` (`scripts/lib/agent-guard.mjs`, `scripts/agent-guard.mjs`)**:
  - Pass `--model` and `--effort` to `agy -p` for base slugs from `agents.antigravity.main`, omitting `--effort` when the configured model slug already carries an effort suffix (`-low`, `-medium`, `-high`, `-xhigh`, `-max`) to prevent `agy 1.5.18` CLI conflict.
  - Generate and pass isolated per-session `--settings <tmp>` without `--sandbox` (which blocks `gh`), omitting `modelProvider` locally when `GEMINI_API_KEY` is unset so cached subscription login works without modifying `~/.gemini/antigravity-cli/settings.json`, while keeping `modelProvider: 'gemini'` in cloud or when `GEMINI_API_KEY` is set. Never add `command(agy)` to `BASE_PROGRAMS` or the allowlist.
  - Extend `Tracker` and `runGuard` to record per-subagent turns and tokens in the guard summary alongside run totals.
- **Frictionless local Antigravity switching (`scripts/lib/go-local.mjs`, `scripts/go-local.mjs`)**:
  - Support `--agent claude|antigravity` and runtime auto-detection (`ANTIGRAVITY_AGENT` / `ANTIGRAVITY_CONVERSATION_ID`) so `go-local.mjs <n> --agent antigravity` (or `/relevo:go <n> --local` from Antigravity) runs `agent-guard.mjs` on a `agent.build: claude` repository using `limits.run_max_tokens`, `agents.antigravity` (`--model`, `--effort`), `RELEVO_AGENT=antigravity`, and a temporary `--settings <tmp>`.
  - Stop before creating a worktree if an Antigravity local run has no `limits.run_max_tokens` configured.
- **Per-subagent usage reporting and Gemini quota retry detection (`scripts/lib/run-usage.mjs`, `scripts/lib/messages.mjs`)**:
  - Parse per-subagent turns and tokens from `agent-guard.mjs` summaries into `usage.agents`, format them in `usageLine` (English and Spanish), and preserve them in `usageMarker` / `parseUsageMarker`.
  - Extend `LIMIT_RE` and `reachedUsageLimit` to detect Antigravity/Gemini quota and capacity failures (`exhausted your quota`, `MODEL_CAPACITY_EXHAUSTED`, `prepaid balance is insufficient`) so `limit-retry.mjs` requeues the issue automatically.
- **Pinned `agy 1.5.18+` cloud workflow (`templates/agents/antigravity-step.yml`)**:
  - Pin `agy 1.5.18+` with verified URL and SHA-512, write per-session settings to `$RUNNER_TEMP/relevo-agy-settings.json` passed via `--settings`, keep `--sandbox` off, and pass `--model`/`--effort` via `agent-guard.mjs run`.
- **Architecture Decision Record (`docs/adr/0002-...md`)**:
  - Add the verbatim decision record from Issue #232 documenting why Antigravity subagents use native `invoke_subagent` tiers instead of nested `agy -p` subprocesses.

### Out of Scope

- Automatic cloud failover from Claude Code to Antigravity in GitHub Actions (future issue after single-agent Antigravity cloud builds are verified).
- Tool-agnostic `relevo install`, dual `/relevo:init` / `/relevo:doctor` setup flows, and README/docs overhaul (Issue 3 of the Antigravity parity milestone).
- Enabling `--sandbox` for Antigravity workflows that invoke `gh` or allowing `trust: public` with `agent.build: antigravity`.

## Capabilities

### New Capabilities
<!-- None: all changes extend or revise existing capabilities. -->

### Modified Capabilities
- `configuration`: Allow `limits.run_max_cost` and `limits.run_max_tokens` to coexist, add optional `agents.main` and tool-scoped `agents.claude` / `agents.antigravity` blocks with Antigravity defaults and `auto` floor, and narrow Antigravity validation warnings to specific unapplied fields and effort-suffix conflicts.
- `agent-settings`: Define `agents.main` and Antigravity defaults (`gemini-4-neon` + `high` on main, `inherit` on `dev` and all five QA lenses), apply `agents.main` and valid native `invoke_subagent` tiers for Antigravity, and warn only on unapplied fields (per-subagent `effort`, non-tier subagent models, and main effort-suffix conflicts).
- `project-depth`: Define Antigravity `depth: prototype` behavior: lower `agents.main.effort` to `medium` while keeping `dev` and all five QA lenses on `inherit`.
- `agent-adapters`: Pass `--model`/`--effort` (with effort-suffix conflict guard) and per-session `--settings <tmp>` (local subscription vs cloud `modelProvider`, no `--sandbox`, no `command(agy)` in allowlist) through `agent-guard.mjs`, track per-subagent turns and tokens in its summary, pin `agy 1.5.18+` with verified SHA-512 in `antigravity-step.yml`, and emit native `invoke_subagent` `Model` tier launches and `--agent antigravity` local delegation in rendered Antigravity skills.
- `execution-modes`: Support `--agent claude|antigravity` and runtime auto-detection in `go-local.mjs` with `limits.run_max_tokens` pre-check and temporary `--settings <tmp>`, and parse/display per-subagent turns and tokens from `agent-guard.mjs` summaries in `run-usage.mjs`.
- `usage-limit-retry`: Detect Antigravity/Gemini quota and capacity error messages (`exhausted your quota`, `MODEL_CAPACITY_EXHAUSTED`, `prepaid balance is insufficient`) in `reachedUsageLimit` so `limit-retry.mjs` requeues the issue automatically.
- `init-doctor`: Report targeted warnings in `doctor` and `init` only for unapplied Antigravity `agents.*` fields (per-subagent `effort`, non-tier subagent models) and `agents.main` effort-suffix conflicts instead of warning on all `agents.*` keys.

## Impact

- **Configuration & model planning**: `scripts/lib/config.mjs`, `scripts/lib/model-plan.mjs`, `scripts/model-plan.mjs`, `templates/relevo.yml`.
- **Runtime guard, local runner & usage**: `scripts/lib/agent-guard.mjs`, `scripts/agent-guard.mjs`, `scripts/lib/go-local.mjs`, `scripts/go-local.mjs`, `scripts/lib/run-usage.mjs`, `scripts/lib/messages.mjs`.
- **Adapter, cloud workflow & diagnostics**: `scripts/lib/adapters/antigravity.mjs`, `templates/agents/antigravity-step.yml`, `scripts/lib/doctor.mjs`, `scripts/lib/init.mjs`.
- **Documentation**: `docs/adr/0002-antigravity-subagents-use-native-invoke-subagent-tiers-instead-of-nested-agy-p-subprocesses.md`.
- **Tests**: `tests/config.test.mjs`, `tests/depth.test.mjs`, `tests/model-plan.test.mjs`, `tests/agent-guard.test.mjs`, `tests/go-local.test.mjs`, `tests/usage.test.mjs`, `tests/limit-retry.test.mjs`, `tests/agent-workflow.test.mjs`, `tests/adapter-antigravity.test.mjs`, `tests/doctor.test.mjs`, `tests/init.test.mjs`, `tests/messages-language.test.mjs`.
- **External inputs**: `GEMINI_API_KEY` secret in GitHub Actions for live Antigravity cloud build verification.
