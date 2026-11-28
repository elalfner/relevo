# Proposal

## Why

Relevo's Antigravity plugin adapter (`scripts/lib/adapters/`) was built against `agy 1.4.4` and has drifted behind both `agy 1.5.18` and Claude Code's current workflows (`go`, `fix`, `review`, `think`, and `time-guard`). Bringing the adapter to full parity with `agy 1.5.18` — grounded in an empirical spike — gives Antigravity users verified tool lists, parallel QA lenses with failure recovery, native time-limit enforcement, synced local/interactive `go` flows, and `1.5.18` global skill discovery without altering Claude Code.

## What Changes

- **Empirical `agy 1.5.18` spike (`docs/pilot-findings.md`)**: Run `RELEVO_AGY_CHECK=1` and targeted live probes on `agy 1.5.18` before changing any tool mapping, model tier, hook payload, or sandbox assumption (Constraint C3), recording `init.tools`, `invoke_subagent` `pro`/`flash` tier resolution under `gemini-4-neon-high`, `--model` + `--effort` interaction, `--settings` with cached subscription login, `--sandbox` access to `git`/`gh`, `stream-json` event structure, and live `PreToolUse` payload fields.
- **Verified tool mappings (`scripts/lib/adapters/tools.mjs`, `scripts/lib/adapters/antigravity.mjs`)**: Align `ANTIGRAVITY_TOOLS` and `TOOL_WORDS` with the live `agy 1.5.18` `init.tools` registry so rendered `agents/relevo-*.md` list only verified tools (QA lenses strictly read-only) and pass `agy plugin validate`.
- **Parallel QA lenses with reactive wakeup and batch watchdog (`scripts/lib/adapters/antigravity.mjs`)**: Replace sequential Antigravity QA lens wording with parallel per-batch `invoke_subagent` launches in one turn, a `schedule` batch watchdog, reactive wakeup without polling, immediate `manage_subagents` cleanup on completion, and single-lens partial-failure retry preserving completed reports. Adapt `skills/go/SKILL.md`, `skills/go/references/qa-run.md`, `skills/fix/SKILL.md`, and `skills/review/SKILL.md` during rendering so no Claude-only phrases (`Agent` tool, Claude `effort` launch params, mandatory `<usage>` block, `${CLAUDE_PLUGIN_ROOT}`, `relevo:qa-*`) remain.
- **Native Antigravity `hooks.json` and dual-payload `time-guard` (`scripts/lib/adapters/antigravity.mjs`, `scripts/lib/time-guard.mjs`, `scripts/time-guard.mjs`)**: Render `<plugin_dir>/hooks.json` at the plugin root (never `hooks/hooks.json`) invoking `time-guard.mjs` on Antigravity `PreToolUse`. Extend `time-guard.mjs` to handle both Claude (`tool_name`/`tool_input`) and Antigravity (`toolCall.name`/`toolCall.args`, camelCase) payloads, returning `{ "decision": "deny", "reason": ... }` for Antigravity while leaving Claude Code's `hookSpecificOutput` contract unchanged.
- **Synced `WHERE_RUNS` for Antigravity `go` (`scripts/lib/adapters/antigravity.mjs`)**: Sync `WHERE_RUNS_FOR_ANTIGRAVITY` with current `skills/go/SKILL.md`: `--local` launches `go-local.mjs` in the background forwarding `--retry`/`--resume`, prints `go-local.mjs status <issue>`, and finishes with `next-step.mjs --conversation`; interactive mode prints `next-step.mjs --build-warning --issue <issue>` and isolates execution in a `Workspace: 'share'` subagent with a `schedule` watchdog.
- **`agy 1.5.18` global skill discovery (`scripts/doctor.mjs`, `scripts/lib/adapters/antigravity.mjs`)**: Check `~/.agents/skills` and `~/.gemini/config/skills` in addition to existing skill folders when `/relevo:doctor` runs and in the Antigravity-rendered `/relevo:think` skill.

### Out of Scope

- Model settings (`agents.main`, `agents.claude`/`agents.antigravity`), dual limits coexistence, `go-local.mjs` flags, and `antigravity-step.yml` cloud workflow updates (deferred to Issue 2 of the Antigravity parity milestone).
- Tool-agnostic `relevo install`, dual `/relevo:init` / `/relevo:doctor` flows, and README/docs overhaul (deferred to Issue 3 of the Antigravity parity milestone).
- Any change to Claude Code's plugin manifest, `hooks/hooks.json`, `agents/`, or `skills/` source behavior (Constraint C1).

## Capabilities

### New Capabilities
<!-- None: all changes extend or revise existing capabilities. -->

### Modified Capabilities
- `agent-adapters`: Ground Antigravity tool mappings in the `agy 1.5.18` spike, replace sequential QA lens calls with parallel per-batch `invoke_subagent` launches plus a `schedule` watchdog and partial-failure recovery, strip all remaining Claude-only phrases from rendered `go`/`qa-run`/`fix`/`review`/`think` files, render root `<plugin_dir>/hooks.json` with dual-payload `time-guard.mjs` support, sync `WHERE_RUNS` (`--local` and interactive `go`), and add `1.5.18` global skill folders to rendered `think`.
- `init-doctor`: Include `~/.agents/skills` and `~/.gemini/config/skills` in global skill discovery when `doctor` checks the required skills of `think`.

## Impact

- **Adapter & hooks**: `scripts/lib/adapters/antigravity.mjs`, `scripts/lib/adapters/tools.mjs`, `scripts/lib/time-guard.mjs`, `scripts/time-guard.mjs`.
- **Doctor skill discovery**: `scripts/doctor.mjs` (and `scripts/init.mjs` / `scripts/init-local.mjs` if sharing the global skill directory list, while keeping Claude Code behavior unchanged).
- **Documentation**: `docs/pilot-findings.md` (new `agy 1.5.18` empirical spike section).
- **Tests**: `tests/adapter-antigravity.test.mjs`, `tests/time-guard.test.mjs`, `tests/doctor.test.mjs`.
- **Single source of truth (C1)**: No generated Antigravity plugin files are committed; Claude Code's plugin files remain unchanged.
