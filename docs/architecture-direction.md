# Direction: a neutral core and one adapter per agent

A note for the maintainer, in English only like the pilot findings. It records where Relevo is heading so that the next change does not contradict it. **Nothing here is built, and nothing here is a commitment.**

## Why write it down

Relevo today is a Claude Code plugin, distributed as the npm package `@elalfner/relevo` with the command `relevo`. The wish is that, later, `init` asks which tool the team uses (Claude, Antigravity, Gemini, ...) and whether the installation is for the project or for the machine, as `openspec init` does, and that the cloud build can run with another agent than Claude.

## What is neutral today, and what is not

| Part | Where | Neutral? |
|---|---|---|
| Gates, issue parsing and checks, labels, messages, doctor, init plan, review state, design fetch | `scripts/` | yes: plain Node, no agent in it |
| Workflow templates, stack profiles, `relevo.yml` and its checks | `templates/`, `stacks/` | yes, except the model action and its flags in `relevo-go.yml` |
| Skills and agents | `skills/`, `agents/` | no: Claude Code's format, its subagents (`relevo:dev`, `relevo:qa`) and `${CLAUDE_PLUGIN_ROOT}` |
| The manifest and the marketplace entry | `.claude-plugin/` | no |
| The safety of a cloud run | `relevo-go.yml` | no: a closed tool list, turn and cost limits and the credential are controls of `claude-code-action` |

The valuable and larger part is already neutral. The agent layer and the safety controls are not.

## The shape

- **Core:** the neutral parts above, published as the npm package. The command `relevo` is its entry point.
- **Adapter:** what one agent needs to run the workflow. For Claude Code it is the plugin (skills, agents, manifest), installed with `relevo install --scope user|project|local`, which exists today. For another agent it may be files generated into the project, as OpenSpec does, which would also remove the plugin installation from the cloud run.
- **`init`:** asks for the tools and the scope, installs or generates the adapters, and writes the workflow template for the agent that builds in the cloud.

## Decisions already taken

- The npm package and the command `relevo` are the base. They stay.
- The scope idea (`user`, `project`, `local`) exists in `relevo install` and is the first piece of that `init`.
- Claude Code keeps being the only supported agent until another one is researched.

## What to find out before any design

1. How Antigravity and Gemini CLI load skills, commands and instructions, and whether they have subagents; the formats are not assumed here.
2. Which cloud runner each offers (the Gemini counterpart of `claude-code-action`), and how to give it a closed tool list, turn and cost limits and a credential with the same strength. If a control does not exist, the security page must say so for that agent.
3. Whether the quality of the adversarial QA holds with another model; it needs a trial, not a promise.
4. How the commands are named in each tool, since the `/relevo:` prefix is a Claude Code feature.

## Not now

Building any second adapter, changing the layout of the repository, or changing what Claude users install. The next step is research, then a change that proposes the first non-Claude adapter, with its security story.
