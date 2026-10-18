# Install

English · [Español](install.es.md)

Relevo is a Claude Code plugin. In a terminal:

```bash
claude plugin marketplace add elalfner/relevo
claude plugin install relevo@relevo
```

Restart Claude Code in your project and run `/relevo:doctor` to see what is still missing.

## What you need

- **Claude Code**, where the plugin runs.
- **A GitHub repository.** Version 1 uses GitHub for issues, pull requests and Actions.
- **A Flutter project for Android.** It is the only platform in version 1.
- **Tools Relevo works with but does not bundle:** the [OpenSpec](https://github.com/Fission-AI/OpenSpec) command-line tool (Node.js 20.19 or newer), `git`, the GitHub CLI (`gh`), the toolchain of your platform and, for `think`, the skills listed in [Commands](commands.md#skills-that-think-uses). `/relevo:init` offers to install what is missing, one command at a time.
- **A secret with the model API key** in the GitHub Actions secrets of the repository, for the unattended runs.
- **Branch protection on the integration branch.** On GitHub it needs a public repository or a paid plan. Without it, approving and merging are enforced only by the written confirmation that `ship` asks for.
- **Someone with admin rights** to run `/relevo:init` once.

## First steps

1. Install the plugin as above and run `/relevo:doctor`.
2. Run `/relevo:init`. It shows a plan first, and it is safe to run again.
3. Adjust `relevo.yml` ([Configuration](configuration.md)).
4. Think an idea through with `/relevo:think`, create the issues with `/relevo:issue` and label them `relevo:ready`. From there [the cycle](how-it-works.md) runs.
