---
status: accepted
---

# Antigravity subagents use native invoke_subagent tiers instead of nested agy -p subprocesses

Antigravity CLI `1.5.18` accepts exact model slugs and `--effort` on `agy -p` (including `--agent`), whereas native subagents launched with `invoke_subagent` accept only four model tiers (`flash_lite`, `flash`, `inherit`, `pro`) and no per-subagent effort. We decided to pass `--model` and `--effort` to the main `agy -p` session (`agents.main`) and keep all developer and QA lens launches on native `invoke_subagent` tiers, rather than spawning nested `agy -p --agent <role> --model <slug>` subprocesses through `run_command`.

## Considered Options

- Spawn nested `agy -p --agent` subprocesses in headless runs (cloud and `go-local.mjs`) with an interactive fallback to `invoke_subagent`. Rejected: it would require adding `command(agy)` to the unattended command allowlist, would hide inner turns, tokens and refused actions from `agent-guard.mjs`'s single `stream-json` stream, and would split Antigravity into two separate orchestration paths (interactive vs headless).

## Consequences

- `agent-guard.mjs` keeps full visibility over parent and subagent turns, tokens, denials and sandbox boundaries in one event stream, and the same rendered plugin works across Antigravity App, IDE, CLI, local and cloud.
- Per-subagent `effort` and arbitrary per-subagent model slugs are not enforced until Antigravity exposes them on `invoke_subagent`; `doctor` reports those settings honestly as unapplied, while `agents.ladder` remains name-agnostic so exact slugs will work without changing `relevo.yml` once Antigravity supports them.
