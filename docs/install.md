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
- **OpenSpec and the plugin in a web session.** A session of Claude Code on the web starts in a new container without OpenSpec and without the plugin. `/relevo:init` offers two `SessionStart` hooks in `.claude/settings.json`, only for a remote session: one installs OpenSpec when it is missing (`npm install --global @fission-ai/openspec`) and one installs the plugin ([Work on the web without cloning](#work-on-the-web-without-cloning)); commit the file. Without the first, `go` stops with the install command instead of going on without OpenSpec.
- **In the workflows.** Each workflow downloads the same package at the version it pins (`RELEVO_VERSION`), never the repository, and stops with the name of the missing file if the package lacks a script. The agent of a cloud build loads its plugin from that same package (`--plugin-dir` on the unpacked folder), so the pin decides the skills as well as the scripts, nothing is cloned from the plugin repository and no token is needed to read it. How to move a project from an old version to a new one is in [Upgrading](upgrading.md). The first line of each workflow, `# relevo-template: X.Y.Z`, is the version of the text it was copied from: it is not the pin, and raising the pin by hand moves the scripts but not the text. To move them to a newer version, change the pin in each workflow after reading the changelog; `relevo update` does not touch your workflows. `/relevo:doctor` reports a workflow without a pin, with a pin that differs from the installed plugin, or from the time they cloned the repository.

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

## Work on the web without cloning

A person who works only in Claude Code on the web (a PM, for example) installs nothing and clones nothing. Someone does this once, from a clone, and commits the result.

**Declaring the plugin in the project is not enough on the web.** A cloud session does not install the plugins that `.claude/settings.json` turns on, because adding their marketplace needs the workspace trust dialog, which a cloud session never shows ([Claude Code on the web](https://code.claude.com/docs/en/cloud-environments)). The declaration (`--scope project`) serves a terminal: a teammate who clones the repository is offered the plugin. For the web, the repository also needs a `SessionStart` hook that installs the plugin when the session starts.

1. Run `/relevo:init` (it needs admin rights). It offers, one yes each, the declaration (`install.plugin-project`), the hook that installs OpenSpec (`install.web-hook`) and the hook that installs the plugin (`install.web-plugin-hook`). Without the OpenSpec hook `go` stops in a web session; without the plugin hook there are no `/relevo:` commands.
2. Create the model secret (`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`) in the GitHub Actions secrets, so the cloud builds can run.
3. Commit and push `.claude/settings.json`, `relevo.yml` and the workflows to the default branch. The workflows run from the default branch, so with `main` as default and `dev` as base they reach the cloud only after `dev` is promoted ([Where `go` runs](execution.md#which-branch-the-cloud-reads)).

The plugin hook runs only in a remote session. It adds the marketplace and installs the plugin at the project scope, writes what they print to `relevo-plugin-hook.log` in the temporary folder, and never fails the session:

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin --scope project
claude plugin install relevo@relevo --scope project
```

From then on, anyone who opens the repository in Claude Code on the web finds the `/relevo:` commands listed in the session, and labelling an issue `relevo:ready` starts the build in GitHub Actions, which runs on GitHub's runners and does not depend on the session. Which of them work in that session is another matter: see the first note below. The review on a real device still needs a person with the device.

- **What works on the web, and what does not.** A session of Claude Code on the web blocks GitHub's GraphQL API: `gh issue list`, `gh label list` and `gh pr list` fail with `HTTP 403: GitHub GraphQL is not available from Claude Code sessions; use the REST API`, and `gh auth status` fails with a token that works. For the commands of the person who writes issues, Relevo answers over the REST API there: `/relevo:issue`, `/relevo:status`, `/relevo:think`, `/relevo:init` and `/relevo:doctor` call `scripts/gh-web.mjs`, which takes the arguments of `gh` and, on a terminal, runs `gh` unchanged. Checked in a web session on a sandbox repository: the script created an issue with a milestone and an assignee, changed its body and labels, listed and searched issues and created a label; `/relevo:doctor` reached GitHub and read the workflows of the repository; `/relevo:status` printed its report (it cannot read the `RELEVO_CLOUD_GO` variable through the proxy of the session and says so); `/relevo:init` printed its plan. A person typing `/relevo:issue` there has not been tried yet, because only a person can start it. `/relevo:go`, `/relevo:fix`, `/relevo:ship` and `/relevo:review` still call `gh pr` and `gh issue comment`, which fail the same way: do not use them on the web. A command that needs a subcommand or a flag the script does not cover stops and names it. The build in GitHub Actions does not depend on the session.
- **Checked on a sandbox repository.** A new web session with the hook installed the plugin (0.12.0, then 0.13.0, project scope, enabled), listed `relevo:doctor`, `relevo:status` and the developer and QA agents in its first turn, and `/relevo:doctor` recognised the hook. A session without the hook showed no plugin at all. The build in GitHub Actions was not part of that check.
- **The install may reorder `.claude/settings.json`.** The command can rewrite the file with its keys in another order, which shows as a change to commit; the content is the same.
- **One configuration for the whole organization.** The alternative the documentation names is the server-managed settings of the organization (`extraKnownMarketplaces` and `enabledPlugins` under Organization settings, Claude Code, Managed settings; it needs the Owner role). They apply to every repository of the organization, not to one.

## What you need

- **Claude Code**, where the plugin runs.
- **A GitHub repository.** Version 1 uses GitHub for issues, pull requests and Actions.
- **A project in Flutter, Vue, Laravel or Supabase.** They are the stacks Relevo ships a profile for; for Flutter, `review` works today with Android on a device (the web needs the autopilot, which is off by default); Laravel and Supabase are reviewed with their own tests. Other stacks are declared in [Stacks and platforms](stacks.md).
- **Tools Relevo works with but does not bundle:** the [OpenSpec](https://github.com/Fission-AI/OpenSpec) command-line tool (Node.js 20.19 or newer), `git`, the GitHub CLI (`gh`), the toolchain of your platform and, for `think`, the skills listed in [Commands](commands.md#skills-that-think-uses). `/relevo:init` offers to install what is missing, one command at a time.
- **A secret with the model API key** in the GitHub Actions secrets of the repository, for the unattended runs.
- **Branch protection on the integration branch.** On GitHub it needs a public repository or a paid plan. Without it, approving and merging are enforced only by the written confirmation that `ship` asks for.
- **Someone with admin rights** to run `/relevo:init` once.

## First steps

1. Install the plugin as above and run `/relevo:doctor`.
2. Run `/relevo:init`. It shows a plan first, and it is safe to run again.
3. Adjust `relevo.yml` ([Configuration](configuration.md)).
4. Think an idea through with `/relevo:think`, create the issues with `/relevo:issue` and label them `relevo:ready`. From there [the cycle](how-it-works.md) runs.
