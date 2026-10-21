## Why

Relevo works only with Claude Code. The maintainer works in Antigravity and wants the cloud build to run there too. Checking Antigravity CLI 1.4.4 for real (`docs/pilot-findings.md`, "Antigravity CLI, checked before building the adapter") changed the plan: Antigravity already loads plugins with the same namespaced commands (`/relevo:go`), honours `disable-model-invocation`, runs headless with a documented API-key login for CI, and has a deny list. What it does not do is run Relevo's plugin as it is: a script path variable is not substituted, and a converted agent gets no command tool, so QA could not run the tests. A small renderer closes those two gaps and produces a native Antigravity plugin from the existing sources. The tool also lacks a turn limit and a cost limit, so Relevo has to supply those for the cloud run and say so.

## What Changes

- A renderer turns `skills/`, `agents/`, `scripts/`, `stacks/` and `templates/` into a native Antigravity plugin folder: `plugin.json`, the skills with the text adapted, the agents `relevo-dev` and `relevo-qa` with an explicit tool list, and a copy of what the scripts need. Claude users change nothing: the Claude plugin is not touched.
- `relevo init` asks which tools and which scope (project or machine). For Claude it does what `relevo install` does. For Antigravity it renders the plugin and installs it: into `.agents/plugins/relevo/` for the project, or with `agy plugin install` for the machine. `relevo update` renders again; `relevo doctor` reports a missing, outdated or hand-edited plugin.
- A neutral script, the run guard (`agent-guard.mjs`), starts `agy -p` with `--output-format stream-json`, counts steps and tokens as the events arrive, stops the run at `limits.run_max_turns`, `limits.run_max_tokens` or the time limit, and fails the run when a tool was refused. It supplies the limits the CLI does not have.
- The cloud build workflow has one source: the model step of `relevo-go.yml` is a marked block, replaced for `agent.build: antigravity` by `templates/agents/antigravity-step.yml` (`agy -p` through the guard, user-level settings written on the runner with a closed allow list and deny rules for the web, a job timeout and a key from the secret store). `agent.build` in `relevo.yml` chooses `claude` (default) or `antigravity`.
- The protected paths grow to cover the plugin folder and the agent files, because a run that could edit them could rewrite its own instructions.
- `docs/security.md` (and the Spanish page) states, for each agent, what holds, what holds in part and what does not exist.
- Out of scope: Gemini CLI (a later renderer; it is being replaced by Antigravity CLI for some accounts), generating Claude files, changing what Claude users install, and a trial of QA quality with another model.

## Capabilities

### New Capabilities
- `agent-adapters`: how Relevo renders a plugin for a tool other than Claude Code, how it is installed and kept current, how the cloud run of such an agent is limited, and what it promises.

### Modified Capabilities
- `plugin-distribution`: `relevo init` and the generated plugin's manifest.
- `security`: protected paths for the generated plugin and an honest per-agent statement of controls.

## Impact

- New: `scripts/lib/adapters/` (source reader, renderer interface, `antigravity.mjs`), `scripts/agent-guard.mjs` and its library, `templates/agents/antigravity-step.yml`, the markers in `templates/workflows/relevo-go.yml`, tests.
- Changed: `scripts/cli.mjs` and `scripts/lib/cli.mjs` (`init`, `update`), `scripts/lib/protected-paths.mjs`, `scripts/lib/doctor.mjs`, the `relevo.yml` schema (`agent.build`, `limits.run_max_tokens`), `docs/security.md`, `docs/install.md`, `docs/execution.md`, `docs/architecture-direction.md`, README, changelog, and the Spanish pages.
- No new dependency. `skills/` and `agents/` change only where the design lists neutral wording fixes.
