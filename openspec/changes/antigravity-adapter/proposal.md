## Why

Relevo works only with Claude Code. The research that `docs/architecture-direction.md` asked for is done (see `design.md`). It shows that the neutral part is large and that the agent layer can be generated from the files that exist today. The maintainer works in Antigravity and wants the cloud build to run there too. Antigravity is a good first adapter: its IDE, App and CLI read the same skill and subagent files, its CLI has a documented headless mode, a documented API-key login for CI and a documented deny list. It also lacks a turn limit and a cost limit, so Relevo has to supply those itself and say so.

## What Changes

- A generator renders Relevo's skills and its two agents (`dev`, `qa`) for a tool, from the single source that exists today (`skills/`, `agents/`). Claude users change nothing: the plugin stays as it is and Claude files are not generated.
- The Antigravity renderer writes each skill as `relevo-<name>/SKILL.md` and `dev` and `qa` as the subagents `relevo-dev` and `relevo-qa`, into `.agents/skills/` and `.agents/agents/` (project) or the machine folders under `~/.gemini/` (machine). Commands are therefore `/relevo-go`, not `/relevo:go`.
- `relevo init` asks which tools and which scope (project or machine), writes the files and a manifest `.relevo/adapters.json`. `relevo update` regenerates them and removes stale ones. `relevo doctor` reports a missing, outdated or hand-edited file.
- `relevo run <script>` runs a script of the installed package, so generated text does not need `${CLAUDE_PLUGIN_ROOT}`.
- A new neutral script, the run guard (`relevo run agent-guard`), starts the agent's headless command, reads its event stream and stops it when `limits.run_max_turns`, `limits.run_max_tokens` or the time limit is reached, and fails the run when the agent reports a refused tool. It is what gives the cloud run the limits that Antigravity's CLI does not have.
- The cloud build workflow has one source: the model step of `relevo-go.yml` is a marked block, and for `agent.build: antigravity` it is replaced by the block in `templates/agents/antigravity-step.yml` (`agy -p` through the guard, user-level settings written on the runner with a closed allow list and deny rules for the web, a job timeout, a credential from the secret store). `agent.build` in `relevo.yml` chooses between `claude` (default) and `antigravity`.
- The protected paths grow to cover the generated files, because a run that could edit them could rewrite its own instructions.
- `docs/security.md` (and the Spanish page) states, for each agent, what holds, what holds in part and what does not exist.
- Out of scope: Gemini CLI (a later renderer; it reads `.agents/skills` but needs TOML commands and is being replaced by Antigravity CLI for some accounts), generating Claude files, changing what Claude users install, and a trial of QA quality with another model (recorded separately).

## Capabilities

### New Capabilities
- `agent-adapters`: how Relevo's skills and agents are rendered for a tool other than Claude Code, where they are written, how they are kept current, how the cloud run of such an agent is limited, and what it promises.

### Modified Capabilities
- `plugin-distribution`: `relevo init`, `relevo run` and the manifest.
- `security`: protected paths for generated files and an honest per-agent statement of controls.

## Impact

- New: `scripts/lib/adapters/` (source reader, renderer interface, `antigravity.mjs`), `scripts/agent-guard.mjs` and its library, `templates/agents/antigravity-step.yml`, the markers in `templates/workflows/relevo-go.yml`, tests.
- Changed: `scripts/cli.mjs` and `scripts/lib/cli.mjs` (`init`, `run`), `scripts/lib/protected-paths.mjs`, `scripts/lib/doctor.mjs`, the `relevo.yml` schema (`agent.build`, `limits.run_max_tokens`), `docs/security.md`, `docs/install.md`, `docs/execution.md`, `docs/architecture-direction.md`, README, changelog, and the Spanish pages.
- No new dependency. The sources `skills/` and `agents/` change only where the design lists neutral wording fixes.
