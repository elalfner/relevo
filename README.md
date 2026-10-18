<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/svg/relevo-lockup-horizontal-white.svg">
  <img alt="Relevo" src="docs/brand/svg/relevo-lockup-horizontal-black.svg" width="420">
</picture>

**An automatic issue-to-merge workflow where AI agents build and people verify.**

English · [Español](README.es.md) · [Documentation](docs/README.md)

</div>

> *Relevo* is Spanish for "relay". The issue goes in, AI agents build and check the work in the cloud, and you step in only to think, to test on a real device and to decide. Every step is a handoff: the agent passes the baton to a person, and that person passes it to a peer.

> **Status: early development.** All the commands below exist. The solo cycle (`go`, `review`, `ship`) has run once on a real repository and a real Android device; the team features (peer review, review reminders and escalation, reviewer selection) are covered by tests only and have not run against a live team yet. See [pilot findings](docs/pilot-findings.md).

## Install

Relevo is a Claude Code plugin. In a terminal:

```bash
claude plugin marketplace add elalfner/relevo
claude plugin install relevo@relevo
```

Restart Claude Code in your project and run `/relevo:doctor` to see what is still missing. What you need and the first steps are in [Install](docs/install.md).

## How it works

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/animation/relevo-logo-animated-white.svg">
  <img alt="Relevo" src="docs/brand/animation/relevo-logo-animated-black.svg" width="220">
</picture>

*The logo is the flow: the issue comes in on the left, AI agents work inside the circle, and the feature goes out on the right. The circle turns black only when a person holds the baton: thinking and reviewing.*

</div>

|  | Command | What it does |
|:---:|---|---|
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-init-white.svg"><img alt="init" src="docs/brand/states/relevo-state-init-black.svg" width="72"></picture> | `/relevo:init` | Sets up your repository once: config, labels, branch protection and workflows. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-feature-white.svg"><img alt="feature" src="docs/brand/states/relevo-state-feature-black.svg" width="72"></picture> | **feature** | Not a command, but the reason for the whole flow: the concept of what you want built. Every cycle starts here, and everything below turns it from idea into delivered work. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-think-white.svg"><img alt="think" src="docs/brand/states/relevo-state-think-black.svg" width="72"></picture> | `/relevo:think` | You and the AI explore the idea and settle every decision before any issue exists. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-issue-white.svg"><img alt="issue" src="docs/brand/states/relevo-state-issue-black.svg" width="72"></picture> | `/relevo:issue` | Turns the idea into issues that pass the spec check, or rewrites an issue that is not being built yet. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-go-white.svg"><img alt="go" src="docs/brand/states/relevo-state-go-black.svg" width="72"></picture> | `/relevo:go` | AI agents build the issue and QA checks it, automatically in the cloud, with nobody waiting. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-review-white.svg"><img alt="review" src="docs/brand/states/relevo-state-review-black.svg" width="72"></picture> | `/relevo:review` | You test on a real device while the agent captures and audits the logs. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-fix-white.svg"><img alt="fix" src="docs/brand/states/relevo-state-fix-black.svg" width="72"></picture> | `/relevo:fix` | Fixes what the review found, updating the spec first. |
| <picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-ship-white.svg"><img alt="ship" src="docs/brand/states/relevo-state-ship-black.svg" width="72"></picture> | `/relevo:ship` | Verifies approval, archives the spec, merges and closes the loop. |

Plus `/relevo:status` (who is waiting on what) and `/relevo:doctor` (checks your setup). Every command in detail: [Commands](docs/commands.md). A real run, from idea to merged pull request: [How it works](docs/how-it-works.md).

## Why Relevo

- **Specs first.** The agent builds against detailed issues, and QA checks the diff against them.
- **Pull, not push.** A work-in-progress limit per person keeps the agent from burying the team in unreviewed branches.
- **Humans decide.** Approving and merging are explicit human acts, enforced by branch protection, never by a prompt alone.
- **Every handoff is one message** that says what happened, what is expected of you, and which command to run next.

## Documentation

- [Install](docs/install.md): what you need and the first steps.
- [How it works](docs/how-it-works.md): the idea, and a real run from idea to merged pull request.
- [Commands](docs/commands.md): the nine commands, and the skills that `think` uses.
- [Configuration](docs/configuration.md): the `relevo.yml` file.
- [All the documentation](docs/README.md): reference, how it was built, and the brand.

## Acknowledgements

Relevo builds on [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [mattpocock/skills](https://github.com/mattpocock/skills), both MIT licensed. Their notices are in [NOTICE](NOTICE).

## License

[MIT](LICENSE) for the software and the documentation. The Relevo name and logo are not covered by it: see [TRADEMARKS.md](TRADEMARKS.md).
