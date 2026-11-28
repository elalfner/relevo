# Tasks

## 1. Empirical agy 1.5.18 spike

- [x] 1.1 Run `RELEVO_AGY_CHECK=1 node --test tests/adapter-antigravity.test.mjs` and targeted probes on authenticated local `agy 1.5.18` to capture: `init.tools`, `invoke_subagent` `pro`/`flash` tier resolution under `gemini-4-neon-high`, `--model` + `--effort` interaction, `--settings` with cached subscription login (without `modelProvider`), `--sandbox` access to `git` and `gh`, `stream-json` `conversation_id`/`step_type: "subagent"`/`usage`, and live `PreToolUse` stdin payloads for orchestrator and subagent tool calls; verify raw probe outputs are collected for every item.
- [x] 1.2 Record a dated `agy 1.5.18` spike section in `docs/pilot-findings.md` with all observed facts from 1.1 and verify every assumption (A1–A4) and hook payload field is explicitly answered before editing adapter code.

## 2. Verified tool mappings

- [x] 2.1 Update `ANTIGRAVITY_TOOLS` in `scripts/lib/adapters/tools.mjs` and `TOOL_WORDS` in `scripts/lib/adapters/antigravity.mjs` strictly from the `init.tools` registry recorded in `docs/pilot-findings.md` (keeping QA lenses strictly read-only, `Bash` mapped only to `run_command`, and `UnmappedToolError` fail-closed), and verify `node --test tests/adapter-antigravity.test.mjs` passes.

## 3. Parallel QA lenses, batch watchdog, and Claude wording cleanup

- [x] 3.1 Update `FOREGROUND_FOR_ANTIGRAVITY` and `adaptText` in `scripts/lib/adapters/antigravity.mjs` so rendered `go/SKILL.md`, `qa-run.md`, `fix/SKILL.md`, and `review/SKILL.md` launch all active QA lenses of a batch in parallel in one turn via `invoke_subagent`, set a `schedule` batch watchdog, collect reports via reactive wakeup without polling, terminate each finished subagent immediately with `manage_subagents`, and retry only a stalled or failed lens once while keeping completed reports; verify fail-fast anchor assertions catch drifted headings.
- [x] 3.2 Strip remaining Claude-only phrases (`Agent` tool, Claude `effort` launch params, mandatory `<usage>` block, `${CLAUDE_PLUGIN_ROOT}`, `relevo:dev`/`relevo:qa-*`) in Antigravity-rendered `go/SKILL.md`, `qa-run.md`, `fix/SKILL.md`, and `review/SKILL.md` without editing Claude Code source files (C1); add unit and negative-scan tests in `tests/adapter-antigravity.test.mjs` and verify `node --test tests/adapter-antigravity.test.mjs` passes.

## 4. Native Antigravity hooks.json and dual-payload time-guard

- [x] 4.1 Update `renderAntigravity` in `scripts/lib/adapters/antigravity.mjs` to emit native `<plugin_dir>/hooks.json` (never `hooks/hooks.json`) invoking `scripts/time-guard.mjs` on Antigravity `PreToolUse`, and add tests in `tests/adapter-antigravity.test.mjs` verifying root placement, Antigravity hook map schema, and command path.
- [x] 4.2 Extend `scripts/lib/time-guard.mjs` and `scripts/time-guard.mjs` to handle both Claude (`tool_name`/`tool_input`) and Antigravity (`toolCall.name`/`toolCall.args`, camelCase, using the spike-verified subagent discriminator) payloads, returning `{ "decision": "deny", "reason": ... }` for Antigravity while keeping `hookSpecificOutput` unchanged for Claude Code; add dual-payload tests in `tests/time-guard.test.mjs` and verify `node --test tests/time-guard.test.mjs` passes.

## 5. Synced WHERE_RUNS and global skill discovery

- [x] 5.1 Sync `WHERE_RUNS_FOR_ANTIGRAVITY` in `scripts/lib/adapters/antigravity.mjs` with current `go` (`--local` runs `go-local.mjs` in the background forwarding `--retry`/`--resume`, prints `go-local.mjs status <issue>`, and finishes with `next-step.mjs --conversation`; interactive mode prints `next-step.mjs --build-warning --issue <issue>` and isolates execution in a `Workspace: 'share'` subagent with a `schedule` watchdog); add tests in `tests/adapter-antigravity.test.mjs` and verify they pass.
- [x] 5.2 Add `~/.agents/skills` and `~/.gemini/config/skills` to `skillDirs` in `scripts/doctor.mjs` and to Antigravity-rendered `skills/think/SKILL.md` via `scripts/lib/adapters/antigravity.mjs` (leaving Claude's `skills/think/SKILL.md` untouched); add tests in `tests/doctor.test.mjs` and `tests/adapter-antigravity.test.mjs` verifying detection and frontmatter reading, and run `node --test tests/doctor.test.mjs tests/adapter-antigravity.test.mjs`.

## 6. Live agy 1.5.18 validation and end-to-end verification

- [x] 6.1 Run `npm test` and `RELEVO_AGY_CHECK=1 node --test tests/adapter-antigravity.test.mjs` on `agy 1.5.18`, verifying `agy plugin validate` and `init.tools` pass, zero generated plugin files are tracked, and Claude Code's `skills/`, `agents/`, `hooks/hooks.json`, and `.claude-plugin/` remain unchanged.
- [x] 6.2 Verify in an interactive `agy 1.5.18` session that `/relevo:go` launches active QA lenses in parallel in one turn, terminates each lens via `manage_subagents` on completion, and records the live confirmation in `docs/pilot-findings.md`.
