# Install

English · [Español](install.es.md)

New here? [Get started](get-started.md) takes you from nothing to your first merged pull request, step by step. This page is the reference for what you need.

Relevo is a Claude Code plugin. In a terminal:

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin
claude plugin install relevo@relevo
```

That installs it for every project of the machine. To install it for one repository only, add `--scope project` to the second command (shared with the team through `.claude/settings.json`) or `--scope local` (only you). Only the plugin is installed (scripts, skills, agents, stack profiles and templates); the documentation is online.

A shortcut, if you prefer one command: `npm install -g @elalfner/relevo` gives you `relevo install`, which asks where to install it (the project is preselected; `relevo install --scope project` skips the question), `relevo update` and `relevo doctor`.

```bash
npm install -g @elalfner/relevo
relevo install
```

Restart Claude Code in your project and run `/relevo:doctor` to see what is still missing.

## What is installed

- **The plugin, and only the plugin.** The package `@elalfner/relevo` holds the manifest, the scripts, the skills, the agents, the stack profiles, the templates, the licence and the notice. It does not hold the documentation, the tests, the OpenSpec history, the changelog or the brand material; read those online in the [repository](https://github.com/elalfner/relevo).
- **Machine or project.** `claude plugin install relevo@relevo` (scope `user`, the default) makes the commands available in every project of the machine. `--scope project` declares the plugin in `.claude/settings.json` of the repository, so everyone who opens it is offered the same plugin; `--scope local` keeps it to you. `claude plugin marketplace update relevo` and `claude plugin update relevo@relevo` bring it up to date, which `relevo update` does in one command.
- **In the workflows.** Each workflow downloads the same package at the version it pins (`RELEVO_VERSION`), never the repository, and stops with the name of the missing file if the package lacks a script. To move them to a newer version, change that line in each workflow after reading the changelog; `relevo update` does not touch your workflows. `/relevo:doctor` reports a workflow without a pin, with a pin that differs from the installed plugin, or from the time they cloned the repository.

## Other tools: Antigravity

Claude Code installs the plugin by itself. Another tool gets a plugin rendered for it from the same sources, with the same commands (`/relevo:go`, `/relevo:issue`, …). `relevo init` sets it up:

```bash
relevo init
relevo init --tools claude,antigravity --scope project
```

- **Which tools, and where.** In a terminal it asks which tools (Claude Code, Antigravity) and whether the scope is the project or the machine, with the project preselected inside a git repository. `--tools`, `--scope project|machine` and `--yes` skip the questions, and without a terminal it never waits.
- **Claude Code:** the same as `relevo install`; nothing is rendered for it.
- **Antigravity, project:** the plugin is written into `.agents/plugins/relevo/`, which the IDE, the App and the CLI read. Commit it to share it. A file `.relevo-adapter.json` inside it records the version and a hash of each file.
- **Antigravity, machine:** the plugin is rendered and installed with `agy plugin install` (it needs the Antigravity CLI, `agy`, on the path) into `~/.gemini/config/plugins/relevo/`.
- **Keep it current.** `relevo update` renders the plugin again, and `relevo doctor` (and `/relevo:doctor`) report a missing file, a file from another version and a file edited by hand. `update` does not overwrite an edited file unless you pass `--force`.
- **The folder of the plugin cannot have a space** (or a shell character) in its path, because the skills run their scripts by that path; the command says so and changes nothing.
- **`relevo init` is not `/relevo:init`.** The command puts Relevo's files for a tool in place; the skill sets up the labels, the rules and the workflows of the repository. Do both.
- **What differs from Claude Code:** the cloud build and what it can enforce ([Security](security.md#which-agent-builds)), and `/relevo:go <n> --local`, which starts `claude`, or `agy` when `agent.build` is `antigravity`, in a separate worktree; in an Antigravity session `/relevo:go <n>` already builds in an isolated worktree of its own. A full build with Antigravity, local or in the cloud, has not been tried end to end.

## What you need

- **Claude Code**, where the plugin runs.
- **A GitHub repository.** Version 1 uses GitHub for issues, pull requests and Actions.
- **A project in Flutter, Vue, Laravel or Supabase.** They are the stacks Relevo ships a profile for; for Flutter, `review` works today with Android on a device (the web needs the autopilot, which is off by default). Other stacks are declared in [Stacks and platforms](stacks.md).
- **Tools Relevo works with but does not bundle:** the [OpenSpec](https://github.com/Fission-AI/OpenSpec) command-line tool (Node.js 20.19 or newer), `git`, the GitHub CLI (`gh`), the toolchain of your platform and, for `think`, the skills listed in [Commands](commands.md#skills-that-think-uses). `/relevo:init` offers to install what is missing, one command at a time.
- **A secret with the model API key** in the GitHub Actions secrets of the repository, for the unattended runs.
- **Branch protection on the integration branch.** On GitHub it needs a public repository or a paid plan. Without it, approving and merging are enforced only by the written confirmation that `ship` asks for.
- **Someone with admin rights** to run `/relevo:init` once.

## First steps

1. Install the plugin as above and run `/relevo:doctor`.
2. Run `/relevo:init`. It shows a plan first, and it is safe to run again.
3. Adjust `relevo.yml` ([Configuration](configuration.md)).
4. Think an idea through with `/relevo:think`, create the issues with `/relevo:issue` and label them `relevo:ready`. From there [the cycle](how-it-works.md) runs.
