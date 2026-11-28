# Design

## Context

See `proposal.md` for motivation and scope.

Relevo maintains a single Claude Code source tree (`skills/`, `agents/`, `scripts/`, `stacks/`, `knowledge/`, `templates/`, `hooks/`) and generates the native Antigravity plugin on demand via `scripts/lib/adapters/antigravity.mjs` and `scripts/lib/adapters/tools.mjs` (Constraint C1: no generated Antigravity files are committed, and Claude Code stays untouched).

Current state observed in the repository:
- `scripts/lib/adapters/tools.mjs` maps Claude tools to `agy 1.4.4` names (`view_file`, `list_dir`, `write_to_file`, `replace_file_content`, `multi_replace_file_content`, `run_command`, `grep_search`, `find_by_name`), and `antigravity.mjs` mirrors three of them in `TOOL_WORDS`.
- `scripts/lib/adapters/antigravity.mjs` replaces `## Subagents run in the foreground` with sequential one-at-a-time lens instructions, replaces `## Where it runs` with an older `1.4.4` block missing `--local` backgrounding/`--retry`/`--resume`/`status`/`--conversation` and interactive `--build-warning`, leaves Claude-only phrasing in `skills/go/references/qa-run.md`, `skills/fix/SKILL.md`, and `skills/review/SKILL.md`, emits no `hooks.json`, and does not adapt `skills/think/SKILL.md`'s global skill paths.
- `scripts/lib/time-guard.mjs` and `scripts/time-guard.mjs` only parse Claude Code's `PreToolUse` payload (`tool_name`, `tool_input`, `agent_id`) and emit `{ hookSpecificOutput: { hookEventName, permissionDecision, permissionDecisionReason } }`.
- `scripts/doctor.mjs` (as well as `scripts/init.mjs` and `scripts/init-local.mjs`) currently checks `['.claude/skills', '.agents/skills', '${homedir()}/.claude/skills']`, missing Antigravity `1.5.18`'s `~/.agents/skills` and `~/.gemini/config/skills`.

## Goals / Non-Goals

**Goals:**
- Run an empirical `agy 1.5.18` spike first and record all findings in `docs/pilot-findings.md` before changing any tool name, hook payload parser, or assumption (Constraint C3).
- Bring `scripts/lib/adapters/` and `time-guard` to full `agy 1.5.18` parity: verified agent tool lists, parallel QA lenses with reactive wakeup and batch watchdog, native root `hooks.json` with dual-payload `time-guard.mjs`, synced `WHERE_RUNS`, Claude-free rendered skills/references, and `1.5.18` global skill discovery.
- Keep Claude Code completely unaffected (manifest, hooks, agents, skills, and `time-guard` output format).

**Non-Goals:**
- Model configuration (`agents.main`, `agents.claude`/`agents.antigravity`), dual limits coexistence, `go-local.mjs` flag changes, or `antigravity-step.yml` cloud workflow changes (Issue 2).
- Tool-agnostic `relevo install`, dual `/relevo:init` / `/relevo:doctor` workflows, or README/guide overhaul (Issue 3).
- Introducing a Python runtime or `run_workflow` dependency for parallel QA lenses.

## Decisions

### 1. Empirical `agy 1.5.18` spike gates all adapter changes (C3, D16)
Execute `RELEVO_AGY_CHECK=1 node --test tests/adapter-antigravity.test.mjs` and targeted CLI probes on an authenticated local `agy 1.5.18` before editing `tools.mjs` or `time-guard.mjs`, recording every empirical result in a dated section of `docs/pilot-findings.md`:
1. `init.tools` array from `agy -p ... --output-format stream-json` (verifying file/search/command tool names, e.g., `read_file`/`write_file`/`edit_file` vs `view_file`/`write_to_file`/`replace_file_content`, and confirming read-only separation).
2. `invoke_subagent` `pro` and `flash` tier resolution under `gemini-4-neon-high` (unblocks Issue 2).
3. `--model` + `--effort` CLI interaction, `--settings` with cached subscription login (without `modelProvider`), and whether `--sandbox` allows `git` and `gh` (unblocks Issue 2).
4. `stream-json` verification of `conversation_id`, `step_type: "subagent"`, and per-step `usage`.
5. Live `PreToolUse` hook stdin payload for both orchestrator (`invoke_subagent`) and subagent tool calls, confirming the exact camelCase field(s) that identify a subagent call so `time-guard.mjs` enforces the hard stop accurately without blocking orchestrator cleanup.

- *Why*: Prevents tool-name hangs and silent hook mismatches across `agy` versions and gives Issues 2 and 3 ground-truth facts.
- *Alternatives discarded*: Guessing tool names or hook fields from docs alone (violates C3).

### 2. Verified tool table with fail-closed unmapped checks
Update `ANTIGRAVITY_TOOLS` in `scripts/lib/adapters/tools.mjs` and `TOOL_WORDS` in `scripts/lib/adapters/antigravity.mjs` strictly from the `init.tools` list recorded in the spike. Keep `Bash` mapped only to `run_command` (no `command_status`), keep QA lenses strictly free of write/edit tools, and preserve `UnmappedToolError` fail-closed behavior so any unrecognized Claude tool aborts rendering before writing files.

- *Why*: Antigravity hangs or fails validation when an agent frontmatter references a nonexistent tool.
- *Alternatives discarded*: Loose passthrough or partial mapping.

### 3. Parallel QA lenses via single-turn `invoke_subagent` + `schedule` batch watchdog (D5, D13)
Adapt `FOREGROUND_FOR_ANTIGRAVITY` in `go/SKILL.md` and rewrite the QA launch/collection sections of `qa-run.md` (and subagent launch wording in `fix/SKILL.md`, `review/SKILL.md`, and `go/SKILL.md`) inside `antigravity.mjs`:
- **Developer launches (`relevo-dev`)**: Single `invoke_subagent` call per group/fix/replica, yield turn without polling, reactivate on report, immediately call `manage_subagents` (`Action: "kill"`) to free context.
- **QA lens batches**: Launch all active lenses of the current batch in parallel in **one turn** via multiple `invoke_subagent` calls (matching `lens-plan.mjs` `batches`), set a per-batch watchdog timer via `schedule` (`DurationSeconds`, without polling), and yield the turn.
- **Reactive collection & cleanup**: As each lens message arrives, save its report, record progress (`progress.mjs lens <lens> --attempt <n> --end`), and immediately terminate that finished subagent with `manage_subagents` (`Action: "kill"`). Keep waiting for remaining batch members without polling. Once all lenses in the batch report, cancel the watchdog with `manage_task` (`Action: "kill"`).
- **Partial-failure recovery (D13)**: If a lens fails or the batch watchdog fires before all lenses reply, kill only the stalled/failed lens(es) via `manage_subagents`, keep every completed sibling report, and retry only the stalled/failed lens once alone (after budget and receipt checks). If it fails again, take the failure path with `lens report invalid`.
- **Claude wording cleanup**: In `antigravity.mjs`, adapt file-aware or pattern-anchored blocks across `go/SKILL.md`, `qa-run.md`, `fix/SKILL.md`, and `review/SKILL.md` so rendered output never mentions Claude's `Agent` tool, Claude `effort` launch params (`model` and `effort` as parameters of the Agent tool), mandatory `<usage>` block parsing (Antigravity subagents do not emit Claude's `<usage>` trailer; record only when present or omit Claude's mandatory wording), `${CLAUDE_PLUGIN_ROOT}`, or `relevo:qa-*` / `relevo:dev`. Fail fast in `adaptText` if an expected anchor heading/block in source skills changes, mirroring the existing `FOREGROUND_HEADING` / `WHERE_RUNS_HEADING` guard.

- *Why*: Eliminates sequential QA bottlenecks, prevents infinite hangs when an async subagent dies silently, and removes contradictory Claude tool instructions that confuse Antigravity models.
- *Alternatives discarded*: Keeping sequential lenses (slow); using Python `run_workflow` (introduces a Python 3.8+ runtime requirement); retrying the entire batch on one lens failure (wastes completed reviews).

### 4. Native root `<plugin_dir>/hooks.json` and dual-payload `time-guard.mjs` (D6)
- **Plugin rendering**: `renderAntigravity` adds a root `hooks.json` file (`path: 'hooks.json'`, never `hooks/hooks.json`) matching Antigravity's native hook map schema:
  ```json
  {
    "relevo-time-guard": {
      "PreToolUse": [
        {
          "matcher": "*",
          "hooks": [
            {
              "type": "command",
              "command": "node <pluginDir>/scripts/time-guard.mjs",
              "timeout": 10
            }
          ]
        }
      ]
    }
  }
  ```
  (Using the validated absolute `pluginDir` path — or relative `scripts/time-guard.mjs` if the spike confirms `agy plugin validate` / runtime preference; `pluginDir` is already guaranteed shell-safe by `checkPluginDir`.)
- **Payload normalization in `scripts/lib/time-guard.mjs`**:
  Add payload detection without breaking Claude Code:
  - **Claude payload**: `typeof call.tool_name === 'string'` -> `format: 'claude'`, `toolName: call.tool_name`, `args: call.tool_input`, `isSubagent: typeof call.agent_id === 'string' && call.agent_id !== ''`, `launchesRelevo: LAUNCH_TOOLS.has(toolName) && String(args?.subagent_type ?? '').startsWith('relevo:')`.
  - **Antigravity payload**: `call.toolCall && typeof call.toolCall.name === 'string'` -> `format: 'antigravity'`, `toolName: call.toolCall.name`, `args: call.toolCall.args`, `launchesRelevo: toolName === 'invoke_subagent' && String(args?.TypeName ?? '').startsWith('relevo-')`, and `isSubagent` determined by the exact camelCase subagent field(s) verified in the live `agy 1.5.18` spike (for example `parentConversationId` / `isSubagent` / `agentType` as observed).
- **Response formatting in `scripts/time-guard.mjs`**:
  - When `format === 'claude'` and `reason` is non-null: emit `{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }` (unchanged).
  - When `format === 'antigravity'` and `reason` is non-null: emit `{ decision: 'deny', reason }`.
  - On no refusal or any parse/read error: print nothing and exit `0`.

- *Why*: Enforces `limits.run_max_minutes` and hard stops in both interactive and headless Antigravity runs using one shared `time-guard.mjs` script.
- *Alternatives discarded*: Outer process timeout only (does not cover interactive sessions or clean subagent cutoffs); duplicating `time-guard.mjs` into a second Antigravity-only script (violates single source of truth).

### 5. Synced `WHERE_RUNS` and `1.5.18` global skill discovery (D8)
- **`WHERE_RUNS_FOR_ANTIGRAVITY` in `antigravity.mjs`**: Update to match current `skills/go/SKILL.md`:
  - `--local`: launch `node ${pluginDir}/scripts/go-local.mjs <issue>` (forwarding `--retry` or `--resume` when present in `$ARGUMENTS`) in the background (`run_command` with `WaitMsBeforeAsync: 500`, reactive notification without polling), print `node ${pluginDir}/scripts/go-local.mjs status <issue>`, state that the build prints a line when something changes, skip the conversation warning, and when the command completes report the outcome and end with `node ${pluginDir}/scripts/next-step.mjs ... --conversation`.
  - Interactive mode (no `--decision` and no `--local`): first run `node ${pluginDir}/scripts/next-step.mjs --build-warning --issue <issue>` and print its output as-is without waiting for an answer; then isolate execution in an ephemeral worktree via `invoke_subagent` (`TypeName: "self"`, `Role: "relevo-builder"`, `Workspace: 'share'`) guarded by a `schedule` watchdog (`DurationSeconds: 1200`, `TimerCondition: "<builder_conversation_id>"`), yield without polling, and kill the subagent with `manage_subagents` upon completion or timeout.
- **Global skill discovery**:
  - Export or share a single global skill directory list (or update `scripts/doctor.mjs` directly, keeping `init.mjs`/`init-local.mjs` aligned if shared) so `doctor` checks `['.claude/skills', '.agents/skills', '${homedir()}/.claude/skills', '${homedir()}/.agents/skills', '${homedir()}/.gemini/config/skills']`.
  - In `antigravity.mjs`, adapt `skills/think/SKILL.md`'s folder check line (`.claude/skills/`, `.agents/skills/` or `~/.claude/skills/`) so the Antigravity-rendered `think` skill also lists `~/.agents/skills/` and `~/.gemini/config/skills/`, leaving the Claude Code source `skills/think/SKILL.md` untouched (C1).

- *Why*: Brings Antigravity's `go` UX in line with `recommend-new-conversation` and `--retry`/`--resume` improvements, and ensures `agy 1.5.16+` users whose global skills live in `~/.agents/skills` or `~/.gemini/config/skills` are detected cleanly by `think` and `doctor`.

## Risks / Trade-offs

- **[Risk] Source skill edits break string-anchored replacements in `antigravity.mjs`** → Mitigation: Use explicit anchor assertions in `adaptText` (throwing on mismatch instead of silently emitting stale Claude text) and add strict negative-scan tests in `tests/adapter-antigravity.test.mjs` covering `go/SKILL.md`, `qa-run.md`, `fix/SKILL.md`, `review/SKILL.md`, and `think/SKILL.md`.
- **[Risk] `agy 1.5.18` `PreToolUse` payload does not include a direct subagent marker field** → Mitigation: Probe this explicitly in the empirical spike (Task 1) before coding `time-guard.mjs`. If `agy 1.5.18` lacks a dedicated subagent field (e.g., only sending `conversationId`), record the exact behavior in `docs/pilot-findings.md` and use the safest verified discriminator (such as comparing `conversationId` or `cwd` against the orchestrator's recorded session/worktree) rather than blocking orchestrator cleanup.
- **[Risk] `agy 1.5.18` renamed file/search tools since `1.4.4`** → Mitigation: Gate `tools.mjs` and `TOOL_WORDS` edits behind the live `RELEVO_AGY_CHECK=1` spike and verify both `agy plugin validate` and `init.tools` match after updating.
- **[Risk] Interactive `go` or parallel QA watchdog fires while a slow lens is still legitimately working** → Mitigation: Choose a generous batch watchdog duration (matching single-lens/build expectations) and retry only the timed-out lens once while preserving all completed reports.

## Assumptions

- **A1**: The spike will observe the underlying models used by `invoke_subagent` `pro` and `flash` tiers under `gemini-4-neon-high`.
- **A2**: The live `init` event (`RELEVO_AGY_CHECK=1`) will confirm current `agy 1.5.18` file tool names.
- **A3**: The spike will confirm `--model` + `--effort` interaction and local `--settings` behavior without `modelProvider`.
- **A4**: `agy 1.5.18` `stream-json` continues emitting `conversation_id`, `step_type: "subagent"`, and per-step `usage`.
- **A5 (minor)**: `scripts/doctor.mjs` checking `~/.agents/skills` and `~/.gemini/config/skills` in addition to `.claude/skills`, `.agents/skills`, and `~/.claude/skills` is safe and non-breaking for Claude Code users because it only widens detection of the four read-only `think` skills (`openspec-explore`, `grill-with-docs`, `grilling`, `domain-modeling`).
