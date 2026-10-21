# Install

English · [Español](install.es.md)

New here? [Get started](get-started.md) takes you from nothing to your first merged pull request, step by step. This page is the reference for what you need.

Relevo is a Claude Code plugin. In a terminal:

```bash
npm install -g @elalfner/relevo
relevo install
```

`relevo install` installs the plugin for every project of the machine. To install it for one repository only, run `relevo install --scope project` (shared with the team through `.claude/settings.json`) or `--scope local` (only you). Without npm, the two `claude plugin` commands do the same:

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin
claude plugin install relevo@relevo
```

Only the plugin is installed (scripts, skills, agents, stack profiles and templates); the documentation is online.

Restart Claude Code in your project and run `/relevo:doctor` to see what is still missing.

## What is installed

- **The plugin, and only the plugin.** The package `@elalfner/relevo` holds the manifest, the scripts, the skills, the agents, the stack profiles, the templates, the licence and the notice. It does not hold the documentation, the tests, the OpenSpec history, the changelog or the brand material; read those online in the [repository](https://github.com/elalfner/relevo).
- **Machine or project.** `relevo install` (scope `user`) makes the commands available in every project of the machine. `--scope project` declares the plugin in `.claude/settings.json` of the repository, so everyone who opens it is offered the same plugin; `--scope local` keeps it to you. `relevo update` brings the plugin and its catalogue up to date.
- **In the workflows.** Each workflow downloads the same package at the version it pins (`RELEVO_VERSION`), never the repository, and stops with the name of the missing file if the package lacks a script. `/relevo:doctor` reports a workflow without a pin or from the time they cloned the repository.

## What you need

- **Claude Code**, where the plugin runs.
- **A GitHub repository.** Version 1 uses GitHub for issues, pull requests and Actions.
- **A project in Flutter, Vue or Laravel.** They are the stacks Relevo ships a profile for; for Flutter, `review` works today with Android on a device (the web needs the autopilot, which is off by default). Other stacks are declared in [Stacks and platforms](stacks.md).
- **Tools Relevo works with but does not bundle:** the [OpenSpec](https://github.com/Fission-AI/OpenSpec) command-line tool (Node.js 20.19 or newer), `git`, the GitHub CLI (`gh`), the toolchain of your platform and, for `think`, the skills listed in [Commands](commands.md#skills-that-think-uses). `/relevo:init` offers to install what is missing, one command at a time.
- **A secret with the model API key** in the GitHub Actions secrets of the repository, for the unattended runs.
- **Branch protection on the integration branch.** On GitHub it needs a public repository or a paid plan. Without it, approving and merging are enforced only by the written confirmation that `ship` asks for.
- **Someone with admin rights** to run `/relevo:init` once.

## First steps

1. Install the plugin as above and run `/relevo:doctor`.
2. Run `/relevo:init`. It shows a plan first, and it is safe to run again.
3. Adjust `relevo.yml` ([Configuration](configuration.md)).
4. Think an idea through with `/relevo:think`, create the issues with `/relevo:issue` and label them `relevo:ready`. From there [the cycle](how-it-works.md) runs.
