# Design

## Context

See `proposal.md` for motivation and scope.

Issue #231 (`antigravity-adapter-parity`, merged at `316ea29`) established the empirical `agy 1.5.18` facts in `docs/pilot-findings.md` that govern this change:
- `agy -p` accepts `--model <slug>` and `--effort <level>` for base slugs (`--model gemini-4-neon --effort low` exits `0`), whereas combining an effort-suffixed slug with a conflicting `--effort` exits `1` (`--model gemini-4-neon-high --effort low`).
- Native `invoke_subagent` accepts only four model tiers (`flash_lite`, `flash`, `pro`, `inherit`) and no per-subagent `effort`; `agents/*.md` frontmatter rejects explicit model IDs in `agy plugin validate`.
- Under `gemini-4-neon-high`, `Model: "pro"` resolves to `gemini-4-hydrogen-tiered-xhigh` and `Model: "flash"` resolves to `gemini-4-hydrogen-tiered-high`, whereas `Model: "inherit"` preserves the exact parent model (`gemini-4-neon-high`).
- `--settings <json|file>` works locally with cached subscription login when `modelProvider` is omitted.
- `--sandbox` blocks `~/.config/gh/config.yml` and network access, preventing `gh` calls.
- `stream-json` emits `init` (`conversation_id`, `model`, `tools`), `step_type: "subagent"` (`tool_name: "invoke_subagent"`, `tool_info.parameters`, `subagent_info.subagents[].conversation_id`), and `agent_response` with per-step `usage`.

Current state observed in the repository:
- `scripts/lib/config.mjs` enforces `rejectedFor` between `limits.run_max_cost` and `limits.run_max_tokens`, supports only a flat Claude-oriented `agents` block (`ladder`, `dev`, `qa.*`), warns on all `agents_given` when `agent.build === 'antigravity'`, and uses hardcoded Claude `AGENT_DEFAULTS` for `depth: prototype`.
- `scripts/lib/model-plan.mjs` reads `AGENT_DEFAULTS` directly (Claude `sonnet`/`opus`) without awareness of `agent.build` or runtime agent override.
- `scripts/lib/agent-guard.mjs` and `scripts/agent-guard.mjs` always write `modelProvider: 'gemini'` in `agySettings`, pass neither `--model`/`--effort` nor `--settings` to `agy -p`, and aggregate only flat run totals without per-subagent breakdown.
- `scripts/lib/go-local.mjs` and `scripts/go-local.mjs` decide Claude vs Antigravity solely from `config.agent.build`, write no per-session `--settings <tmp>`, and have no `--agent` flag or runtime auto-detection.
- `scripts/lib/run-usage.mjs` only builds `usage.agents` from Claude `task_notification` events and `LIMIT_RE` does not match Antigravity/Gemini quota/capacity strings (`exhausted your quota`, `MODEL_CAPACITY_EXHAUSTED`, `prepaid balance is insufficient`).
- `templates/agents/antigravity-step.yml` still pins `agy 1.4.4` and writes settings to `$HOME/.gemini/antigravity-cli/settings.json`.
- `docs/adr/` currently contains only `0001-approval-and-build-request-are-separate-labels.md`.

## Goals / Non-Goals

**Goals:**
- Allow Claude Code and Antigravity limits (`run_max_cost`, `run_max_tokens`) and model blocks (`agents.claude`, `agents.antigravity`, `agents.main`) to coexist in one `relevo.yml`.
- Give Antigravity safe Gemini 4 flagship defaults (`gemini-4-neon` + `high`, `medium` at `depth: prototype`, all subagents on `inherit` with `ladder: [flash_lite, flash, pro, inherit]`) and targeted unapplied-field warnings in validation, `doctor`, and `init` (C4).
- Enable frictionless local switching via `go-local.mjs <n> --agent antigravity` and runtime auto-detection, using per-session `--settings <tmp>` without modifying `~/.gemini/antigravity-cli/settings.json`.
- Upgrade `agent-guard.mjs`, `run-usage.mjs`, and `templates/agents/antigravity-step.yml` to `agy 1.5.18+` with `--model`/`--effort` conflict guarding, per-subagent usage tracking/reporting, and Antigravity quota-limit retry detection.
- Record ADR `0002` verbatim in `docs/adr/`.

**Non-Goals:**
- Automatic cloud failover from Claude Code to Antigravity in GitHub Actions.
- Tool-agnostic `relevo install`, dual `/relevo:init` / `/relevo:doctor` setup flows, or README/docs overhaul (Issue 3).
- Enabling `--sandbox` for Antigravity workflows that call `gh`, adding `command(agy)` to `BASE_PROGRAMS`, or allowing `trust: public` with `agent.build: antigravity`.

## Decisions

### 1. Coexisting limits and tool-scoped `agents` configuration (`scripts/lib/config.mjs`, D3, D10, D11, D14, C4)
- **Limits coexistence**: Remove `rejectedFor` and `rejection` from `limits.run_max_cost` and `limits.run_max_tokens` in `SETTINGS`. Keep `requiredFor: 'claude'` on `limits.run_max_cost` and `requiredFor: 'antigravity'` on `limits.run_max_tokens`. When either setting is present, run `checkType` and store it in `config.limits`, regardless of `agent.build`.
- **Tool defaults (`agentDefaults(depth = 'standard', tool = 'claude')`)**:
  - `claude`: unchanged (`main: null`, `ladder: ['haiku', 'sonnet', 'opus']`, `dev: { model: 'sonnet', effort: 'high' }`, `qa` as today; `depth: prototype` lowers `dev`/`qa` effort by one step and caps `qa` model at `QA_MIN_MODEL = 'sonnet'`).
  - `antigravity`:
    - `main: { model: 'gemini-4-neon', effort: depth === 'prototype' ? 'medium' : 'high' }`
    - `ladder: ['flash_lite', 'flash', 'pro', 'inherit']`
    - `dev: { model: 'inherit', effort: null }`
    - `qa`: all five lenses (`spec`, `security`, `code`, `interface`, `bugs`) set to `{ model: 'inherit', effort: null }`
    - `QA_MIN_MODEL` for `antigravity`: `'inherit'` (so `auto` lenses default to `[inherit, inherit]` unless the repo explicitly sets a lower `floor`).
- **Schema for `agents`**:
  - Accepted keys directly under `agents`: `main`, `ladder`, `dev`, `qa`, `claude`, `antigravity`.
  - `agents.claude` and `agents.antigravity` are optional maps, each accepting `main`, `ladder`, `dev`, `qa`.
  - `main` accepts only `{ model, effort }` (`model`: non-empty string, rejecting `'auto'`; `effort`: enum `EFFORTS`; rejecting `floor`/`ceiling`).
  - Both `claude` and `antigravity` effective agent configs are resolved and validated during `validateConfig`:
    - Each tool merges: `agentDefaults(depth, tool)` ← top-level `agents.{main,ladder,dev,qa}` ← tool-scoped `agents.<tool>.{main,ladder,dev,qa}`.
    - Validation runs on every section actually written in `relevo.yml` (so an error in `agents.antigravity` fails validation even when `agent.build: claude`, and vice versa). Note: top-level `agents.*` without a tool block is validated against the active `agent.build` tool (preserving backward compatibility with existing Claude repos that write top-level `agents.dev: { model: haiku }` — we do NOT spuriously fail a Claude repo's top-level `agents.*` against Antigravity's ladder!). Only an explicitly present `agents.<tool>` block is validated for the inactive tool.
  - `config.agents` holds the active `agent.build` resolved settings; expose a pure helper `agentsFor(config, tool)` (backed by non-enumerable `config.agents_by_tool` and `config.agents_given_by_tool`) so `go-local.mjs`, `agent-guard.mjs`, and `model-plan.mjs` can resolve either tool cleanly.
- **Effort-suffix helper and targeted Antigravity warnings (`antigravityAgentWarnings`)**:
  - Export `MODEL_EFFORT_SUFFIX_RE = /-(low|medium|high|xhigh|max)$/` and `extractEffortSuffix(model)` (returns the suffix string or `null`) plus `ANTIGRAVITY_SUBAGENT_TIERS = ['flash_lite', 'flash', 'pro', 'inherit']`.
  - Export `antigravityAgentDiagnostics(config)` (returning `{ unapplied: [{ path, reason }], conflicts: [{ path, model, suffix, effort, message }] }`) evaluated on the resolved Antigravity settings + `agents_given` paths:
    1. Any explicitly given `effort` on `dev` or `qa.*` (`invoke_subagent` has no per-subagent effort).
    2. Any explicitly given subagent `model`, `floor`, or `ceiling` not in `ANTIGRAVITY_SUBAGENT_TIERS` and not `'auto'` (`invoke_subagent` accepts only the four native tiers).
    3. `agents.main.model` carrying an effort suffix (`-low`/`-medium`/`-high`/`-xhigh`/`-max`) while `agents.main.effort` is explicitly set to a different level (conflict: `--effort` will be omitted to avoid `agy 1.5.18` exit `1`).
  - Use this single diagnostic helper in `validateConfig` (warnings when `build === 'antigravity'`), `scripts/lib/doctor.mjs` (`lensChecks`), and `scripts/lib/init.mjs` (`planInit`) so all three stay identical and satisfy C4.
- *Alternatives discarded*: Rejecting the inactive limit; forcing one flat `agents` block; blanket-ignoring all `agents.*` keys for Antigravity.

### 2. Tool-aware model planning and native `invoke_subagent` tier launches (`scripts/lib/model-plan.mjs`, `scripts/model-plan.mjs`, `scripts/lib/adapters/antigravity.mjs`, D2, D3, D10)
- `planModels({ config, agent, ... })`, `configPlan(config, reason, lenses, { agent })`, and `escalateDev({ config, agent, ... })` accept an optional `agent` (`'claude' | 'antigravity'`), defaulting to `config.agent?.build ?? 'claude'`.
- `scripts/model-plan.mjs` resolves `agent` from `--agent <claude|antigravity>` → `process.env.RELEVO_AGENT` → `loaded.config.agent.build`.
- Replace direct references to Claude's `AGENT_DEFAULTS` inside `planModels` and `configPlan` with `agentDefaults(config.depth, activeAgent)` and read role configs from `agentsFor(config, activeAgent)` (and `given` paths for that tool so `depth: prototype` provenance stays accurate).
- Include `main` in the plan output when `agents.main` is non-null (for Antigravity or when explicitly configured), while keeping `{ dev, qa, signals, notes }` unchanged when `main` is unset.
- In `scripts/lib/adapters/antigravity.mjs`:
  - Update `adaptGo`, `adaptQaRun`, `adaptFix`, and `adaptReview` so rendered instructions pass `Model: "<tier>"` to `invoke_subagent` from the model plan whenever the planned model is a valid native tier (`flash_lite`, `flash`, `pro`, `inherit`), defaulting to `inherit` otherwise, and never passing `effort`.
  - Keep `model-plan.mjs escalate` working for `dev` retries on Antigravity's `ladder`.
  - Update `WHERE_RUNS_FOR_ANTIGRAVITY` so `/relevo:go <issue> --local` invokes `go-local.mjs <issue> --agent antigravity` (forwarding `--retry` / `--resume`).
- *Alternatives discarded*: Spawning nested `agy -p --agent <role> --model <slug>` subprocesses via `run_command` (rejected in D2 and ADR `0002`: would require `command(agy)` in the allowlist, hide inner events from `agent-guard.mjs`, and split interactive vs headless paths).

### 3. `agent-guard.mjs`: `--model`/`--effort`, per-session `--settings`, and per-subagent usage (`scripts/lib/agent-guard.mjs`, `scripts/agent-guard.mjs`, D2, D7, D9, D11, D12, C2, C3)
- **CLI arg builder (`buildAgyArgs({ prompt, timeoutMinutes, model, effort, settings })`)**:
  - Always passes `['-p', prompt, '--output-format', 'stream-json', '--print-timeout', '${Math.ceil(timeoutMinutes) + 1}m']`.
  - When `model` is non-empty: appends `['--model', model]`.
  - When `effort` is non-empty AND `extractEffortSuffix(model)` is `null`: appends `['--effort', effort]`. When `model` carries an effort suffix (`-low`/`-medium`/`-high`/`-xhigh`/`-max`), omits `--effort` to prevent the `agy 1.5.18` CLI exit-1 conflict (D11).
  - When `settings` path is non-empty: appends `['--settings', settings]`.
  - Never appends `--sandbox` (D9, C3).
- **`agySettings({ profile, extra, restricted, includeProvider = true })`**:
  - When `includeProvider` is `true` (default, cloud or `GEMINI_API_KEY` set), includes `modelProvider: 'gemini'`.
  - When `includeProvider` is `false` (local run with `GEMINI_API_KEY` unset), omits `modelProvider` so `agy 1.5.18` uses cached subscription login (D12).
  - Never adds `command(agy)` to `BASE_PROGRAMS` or `allow` (C2); explicitly guards against `agy` even if passed in `extra` or `profile`.
  - `scripts/agent-guard.mjs settings` accepts `--no-provider` (or `--local`, omitting `modelProvider` unless `GEMINI_API_KEY` is non-empty) and `--all-platforms` (unioning tools across all configured platforms when no single `--platform` is known up front, as in `go-local.mjs`).
- **`scripts/agent-guard.mjs run`**:
  - Accepts optional `--model <slug>`, `--effort <level>`, `--settings <file>`.
  - When `--config` is loaded, defaults `--model` and `--effort` from `agentsFor(loaded.config, 'antigravity').main` (so `depth: prototype` and `agents.antigravity.main` apply automatically in both cloud and local runs, while explicit CLI flags override).
  - Sets `RELEVO_AGENT: 'antigravity'` in the spawned `agy` child environment (preserving `process.env`) so nested scripts such as `model-plan.mjs` resolve Antigravity settings even on a `claude` repository.
- **Per-subagent tracking in `Tracker` (`scripts/lib/agent-guard.mjs`)**:
  - Capture `mainConversationId` and `mainModel` from `event === 'init'` (`e.conversation_id`, `e.model ?? e.init?.model`), falling back to the first `step_update.conversation_id` when no `init` event is present.
  - On `step_type === 'subagent'` (`DONE`), read `tool_info?.parameters` (`TypeName`, `Role`, `Model`) and `subagent_info?.subagents` (each `{ conversation_id }`), registering metadata `{ name: TypeName || 'subagent', launch: Role || null, model: Model || null }` for each child `conversation_id`.
  - On every `DONE` `agent_response` (after deduplicating `${conversation_id}:${step_index}`), attribute `turns += 1`, `tokens`, `input`, `output`, `cached` to the conversation's entry in a `Map` preserving insertion order (main first, then subagents).
  - Add `agents` array to `summary` when at least one subagent conversation was seen (or whenever conversations exist with turns): each entry `{ name, ...(launch ? { launch } : {}), ...(model ? { model } : {}), turns, tokens, ...(cached ? { cached } : {}) }`, where `tokens = input + output` (matching top-level `usage` convention; falling back to `total_tokens` when `input`/`output` are absent).
  - Also include `response` (truncated tail when failed) or keep `stderr_tail` so quota errors in either `result.response`/`result.error` or `stderr` are visible to `reachedUsageLimit`.

### 4. Frictionless local Antigravity switching (`scripts/lib/go-local.mjs`, `scripts/go-local.mjs`, D7, D12, D15)
- **Runner selection (`resolveLocalAgent({ agent, config, env })`)**:
  1. Explicit `--agent claude|antigravity` (any other value exits 2 with a clear error).
  2. Runtime auto-detection when `--agent` is omitted: if `env.ANTIGRAVITY_AGENT` or `env.ANTIGRAVITY_CONVERSATION_ID` is non-empty → `'antigravity'`; else `config.agent?.build ?? 'claude'`.
- **Pre-worktree token-limit guard (Edge case 3)**:
  - When resolved local agent is `'antigravity'` and `config.limits?.run_max_tokens` is null/absent: return exit `2` **before** creating any worktree with a clear message instructing the user to set `limits.run_max_tokens` in `relevo.yml`.
- **Command planning (`planLocalRun`)**:
  - For Antigravity:
    - Resolves `main = agentsFor(config, 'antigravity').main`.
    - Computes `settingsPath = join(tmpdir(), 'relevo-agy-settings-<repo>-<issue>.json')` (outside the worktree and outside `~/.gemini/antigravity-cli/settings.json`).
    - Builds `agent-guard.mjs run` args including `--prompt`, `--config relevo.yml`, `--timeout-minutes`, `--summary`, `--settings <settingsPath>`, `--model <main.model>`, and (when `!extractEffortSuffix(main.model)` and `main.effort`) `--effort <main.effort>`.
    - Sets `env: { RELEVO_AGENT: 'antigravity' }`.
    - `--dry-run` prints `worktree:` and `command:` so `--settings`, `--model`, and `--effort` are immediately visible (matching Verification bullet 1).
- **Temp settings lifecycle in `runLocal`**:
  - After creating the worktree and before spawning `agent-guard.mjs run`, generate the temp settings file at `plan.settings` via injected `prepareSettings` (in `scripts/go-local.mjs`: writes `agySettings({ profile: mergedPlatformTools, restricted: agyReadDenials(...), includeProvider: Boolean(process.env.GEMINI_API_KEY) })` without touching `~/.gemini/antigravity-cli/settings.json`).
  - Remove `plan.settings` in a `finally` block after `agent-guard.mjs` finishes.

### 5. Per-subagent usage parsing and Gemini quota-limit detection (`scripts/lib/run-usage.mjs`, `scripts/lib/messages.mjs`, Scenario 5 & 6)
- **Quota/capacity patterns (`LIMIT_RE`)**:
  - Extend `LIMIT_RE` with `exhausted your quota`, `model_capacity_exhausted`, and `prepaid balance is insufficient` (case-insensitive).
  - In `reachedUsageLimit`, when a `result` entry has `exit_code !== 0` (guard summary) or `is_error === true`, test `[e.result, e.error, e.stderr_tail, e.response]` against `LIMIT_RE`.
  - Confirm `decideRetry` in `scripts/lib/limit-retry.mjs` returns `{ action: 'retry', reason: 'backoff', ... }` for Antigravity guard summaries (no rate-limit event -> backoff 30m / 120m / 300m).
- **Per-subagent usage in `run-usage.mjs`**:
  - In `breakdown(all, result)`: if Claude `task_notification` events exist, keep existing Claude logic unchanged. Otherwise, if `Array.isArray(result.agents) && result.agents.length > 0`, parse valid `{ name, launch?, model?, effort?, turns, tokens?, seconds?, cost? }` entries from `result.agents` so `readUsage` populates `usage.agents`.
  - In `usageLine`: extend the per-agent formatter to include `, <n> tokens` (using catalog phrase `agent_tokens` in both `en` and `es` in `scripts/lib/messages.mjs`, keeping `messages-language.test.mjs` parity!) when `a.tokens !== undefined && a.cost === undefined` (or whenever `a.tokens !== undefined`).
  - In `usageMarker` and `parseUsageMarker`: allow optional finite `tokens` (and `launch`) on `agents` entries so bot comments serialize and parse cleanly while the daily digest ignores `agents`.
  - In `limitsExceeded`: check `limits.run_max_tokens` only when `usage.cost === null && usage.tokens !== null` (so Claude repos with coexisting `run_max_tokens` never emit false token-limit warnings, while Antigravity runs report exceeding `limits.run_max_tokens`).

### 6. Pinned `agy 1.5.18+` cloud workflow (`templates/agents/antigravity-step.yml`, D7, D9, C3)
- Fetch the current `1.5.18+` `linux_amd64.json` manifest from `https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/linux_amd64.json` during implementation and pin the exact `AGY_VERSION`, `AGY_URL`, and `AGY_SHA512` (verified via `sha512sum --check --strict -`).
- Write settings to `"$RUNNER_TEMP/relevo-agy-settings.json"` (instead of `$HOME/.gemini/antigravity-cli/settings.json`) and pass `--settings "$RUNNER_TEMP/relevo-agy-settings.json"` to `agent-guard.mjs run`.
- Keep `--sandbox` off (D9, C3) and keep `relevo:credential` / `relevo:agent-step` block boundaries identical so `agentWorkflow` one-source tests pass.
- Note: also include `${{ secrets.GEMINI_API_KEY }}` handling in `antigravity-step.yml` comments/env as today; do not modify shared workflow sections outside the marked blocks.

### 7. Architecture Decision Record (`docs/adr/0002-...md`)
- Create `docs/adr/0002-antigravity-subagents-use-native-invoke-subagent-tiers-instead-of-nested-agy-p-subprocesses.md` with `status: accepted` frontmatter (matching `0001`) and the exact decision record text from Issue #232's `Documentation` section.

## Risks / Trade-offs

- **[Risk] Existing tests assert `limits.run_max_cost` + `limits.run_max_tokens` mutual rejection or blanket Antigravity `agents.*` warnings** → Mitigation: Update affected test assertions in `tests/config.test.mjs`, `tests/doctor.test.mjs`, `tests/init.test.mjs`, `tests/agent-workflow.test.mjs`, and `tests/adapter-antigravity.test.mjs` alongside new coexistence and targeted-warning test cases.
- **[Risk] `agy 1.5.18+` `linux_amd64.json` manifest advances past `1.5.18` before implementation runs** → Mitigation: Read the live manifest during implementation, verify `AGY_VERSION >= 1.5.18`, verify its SHA-512 checksum directly against the downloaded tarball or manifest digest, and pin the exact version, URL, and 128-hex SHA-512 (C3).
- **[Risk] `go-local.mjs --agent antigravity` on a multi-platform repository needs allowed commands for whichever platform the issue targets** → Mitigation: Resolve the issue's `Platform:` when readable, or union commands/tools across all configured platforms in `relevo.yml` when generating the temp `--settings` file (while keeping `DENIED` and `command(agy)` strictly excluded).
- **[Risk] Existing `tests/go-local.test.mjs` runs inside an Antigravity agent session where `ANTIGRAVITY_AGENT` is set in `process.env`** → Mitigation: Keep `planLocalRun` and `runLocal` pure with respect to `env` (defaulting `env = {}` in the library functions and passing `process.env` only in the `scripts/go-local.mjs` CLI entry point), so unit tests remain deterministic regardless of which IDE or CLI runs `npm test`.
- **[Risk] `messages.mjs` catalog parity check fails if a new usage phrase is added only in English** → Mitigation: Add `agent_tokens` (and any new limit/warning phrase) to both `en` and `es` in `USAGE_TEXT` and run `tests/messages-language.test.mjs`.
