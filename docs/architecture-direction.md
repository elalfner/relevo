# Direction: a neutral core and one adapter per agent

A note for the maintainer, in English only like the pilot findings. It records where Relevo is heading so that the next change does not contradict it.

## Why write it down

Relevo began as a Claude Code plugin, distributed as the npm package `@elalfner/relevo` with the command `relevo`. The wish is that a team can use it with the tool it already works in, and that the cloud build can run with another agent than Claude. The first other agent is Antigravity (change `antigravity-adapter`).

## What is neutral, and what is not

| Part | Where | Neutral? |
|---|---|---|
| Gates, issue parsing and checks, labels, messages, doctor, init plan, review state, design fetch | `scripts/` | yes: plain Node, no agent in it |
| Workflow templates, stack profiles, `relevo.yml` and its checks | `templates/`, `stacks/` | yes, except the marked blocks (the credential line and the agent step) of the workflows |
| Skills and agents | `skills/`, `agents/` | the text is neutral; the format is Claude Code's, and a renderer rewrites what differs (the script path, the agent names, the agent frontmatter, one paragraph about waiting for subagents) |
| The manifest and the marketplace entry | `.claude-plugin/` | no |
| The safety of a cloud run | the agent's own runner | no: a closed tool list, turn and cost limits and the credential are controls of each runner, and where one does not exist the security page says so and Relevo supplies it when it can (the run guard) |

## The shape

- **Core:** the neutral parts, published as the npm package. The command `relevo` is its entry point.
- **Source:** `skills/` and `agents/` in Claude Code's format. They are edited once; nothing generated is committed to this repository.
- **Adapter:** what one agent needs to run the workflow. For Claude Code it is the plugin, installed with `relevo install`. For another agent it is a renderer (`scripts/lib/adapters/<agent>.mjs`) that writes a native plugin from the sources, plus, for the cloud, a block file (`templates/agents/<agent>-step.yml`) that replaces the marked blocks of the shared workflow.
- **`relevo init`:** asks for the tools and the scope (project or machine), installs each adapter and records what it wrote; `relevo update` renders again; `relevo doctor` checks it.

## Decisions taken

- The npm package and the command `relevo` are the base. They stay.
- The plugin of a tool is rendered when it is installed, not shipped prebuilt, because the skills have to carry the real path of the plugin: Antigravity does not substitute a plugin root variable.
- The commands keep their names (`/relevo:go`) because the plugin name is the namespace in both tools.
- Antigravity before Gemini CLI: the Gemini CLI pages say Antigravity CLI replaced it for some accounts. A Gemini CLI renderer is possible later; it reads `.agents/skills` but needs TOML commands.
- Claude Code remains the default, and nothing for Claude is generated.

## What is still open

1. A full cloud run with Antigravity on a real runner: the key, the plugin installation on a clean runner and whether the CLI can update itself during a run were not checked (see the known limits of the changelog).
2. Whether the quality of the adversarial QA holds with another model; it needs a trial, not a promise.
3. `/relevo:go <n> --local` starts `claude`; a local run with another agent is the session itself.
