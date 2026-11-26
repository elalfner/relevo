<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/svg/relevo-lockup-horizontal-white.svg">
  <img alt="Relevo" src="docs/brand/svg/relevo-lockup-horizontal-black.svg" width="420">
</picture>

# Stop babysitting your agent. Start shipping.

**AI agent orchestrator, from issue to merge**

Review one while the next one builds.

English · [Español](README.es.md) · [Documentation](docs/README.md)

<picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/animation/relevo-logo-animated-white.svg"><img alt="Relevo" src="docs/brand/animation/relevo-logo-animated-black.svg" width="220"></picture>

</div>

```bash
claude plugin marketplace add elalfner/relevo --sparse .claude-plugin
claude plugin install relevo@relevo
```

Restart Claude Code in your project and run `/relevo:doctor` to see what is still missing. What you need and the first steps are in [Install](docs/install.md).

You need: Claude Code, git, GitHub and its CLI, Node 20.19 or later and OpenSpec.

<details>
<summary>Prefer one command? Use npm</summary>

`npm install -g @elalfner/relevo` gives you `relevo install`, which asks where to install it (the project is preselected; `relevo install --scope project` skips the question), `relevo update` and `relevo doctor`.

```bash
npm install -g @elalfner/relevo
relevo install
```

</details>

<div align="center">

`Claude Code` · `Spec-driven` · `Multi-agent` · `MIT`

| 100+ | 5 | 100k+ |
|:---:|:---:|:---:|
| merged pull requests on real projects | AI agents that review your code | lines in the largest project using it |

[How these were counted](docs/pilot-findings.md#use-on-real-projects-measured-2026-11-25)

</div>

## Relevo catches mistakes before you start testing

<div align="center">

<picture><source media="(prefers-color-scheme: dark)" srcset="docs/cover/qa-en-white.svg"><img alt="An agent builds, your checks run, and a team of agents that did not write the code examines the work: Spec, Security, Code, Bugs and Interface. What blocks is fixed and reviewed again; then you receive it." src="docs/cover/qa-en-black.svg" width="480"></picture>

<sub>Interface runs when there are screens. Bugs advises, or blocks if you turn it on.</sub>

</div>

Your project's checks run first. What blocks goes back to be fixed and is reviewed again, without you stepping in.

## A queue that keeps you moving

Ask for several builds and the queue takes it from there. You test what is ready while the agents keep going in the cloud.

<div align="center">

<picture><source media="(prefers-color-scheme: dark)" srcset="docs/cover/queue-en-white.svg"><img alt="Agents build issues 1, 2 and 3; you review each one while the next is being built" src="docs/cover/queue-en-black.svg" width="640"></picture>

</div>

- Waits for dependencies before starting.
- Holds issues that name the same file, to avoid conflicts.
- Pauses when you have too much waiting for review.
- Retries later when the model usage limit runs out.
- Urgent work jumps ahead.

## A relay between you and your agents

<table>
<tr>
<td align="center" valign="top" width="33%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-think-white.svg"><img alt="think" src="docs/brand/states/relevo-state-think-black.svg" width="96"></picture><br><b>You think</b><br>Decide what to build and approve the issue.<br><code>/relevo:think</code></td>
<td align="center" valign="top" width="33%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-go-white.svg"><img alt="go" src="docs/brand/states/relevo-state-go-black.svg" width="96"></picture><br><b>Agents deliver</b><br>One agent builds and a team of agents reviews it.<br><code>/relevo:go</code></td>
<td align="center" valign="top" width="33%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/brand/states/relevo-state-review-white.svg"><img alt="review" src="docs/brand/states/relevo-state-review-black.svg" width="96"></picture><br><b>You decide</b><br>Test, ask for fixes or approve the merge.<br><code>/relevo:review</code></td>
</tr>
</table>

## Why Relevo?

- **You have the last word.** Approving and merging are a person's decisions.
- **You always know what is next.** Every handoff says what happened, what is expected of you and which command to run.
- **It fits your project.** Your rules, your checks, your limits. In the cloud or on your machine.

## Your code, under control

- The agent never approves or merges: a person does.
- It builds with no web access and a closed list of tools.
- Protected paths, restricted secret files and a credential scan before every commit.
- Per-run limits that you set.

And you review before the merge. See every safeguard in the [security model](docs/security.md).

## FAQ

<details open>
<summary><b>Does it work on large projects?</b></summary>

Yes. It is used on a codebase of over 100,000 lines. On projects like that, tune the checks and the per-run limits.

</details>

<details>
<summary><b>Can it merge without me?</b></summary>

No. A person asks for the merge. To also require someone else's approval, turn on review and GitHub branch protection (on private repositories it depends on your plan).

</details>

<details>
<summary><b>What does it cost?</b></summary>

Relevo is free and MIT. You pay for the model, with an API key or your subscription, and for GitHub runners if you use them. With an API key, the per-run cost limit is a real cap.

</details>

<details>
<summary><b>Does my code leave my infrastructure?</b></summary>

The code the agent reads is sent to the model provider, even when the build runs on your own runner. Relevo adds no server of its own.

</details>

<details>
<summary><b>What if a build fails halfway?</b></summary>

The issue says what happened and what to do. When it stops at a limit or at QA, the work done is kept on its branch.

</details>

<br>

<details>
<summary><b>What does the Relevo logo mean? (and all its commands)</b></summary>

<div align="center">

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

</details>

> **Status: in use on real projects.** Before 1.0, configuration and commands may change between versions; the [changelog](CHANGELOG.md) marks breaking changes.

## Documentation

- [Get started](docs/get-started.md): from nothing to your first merged pull request, step by step.
- [Install](docs/install.md): what you need and the first steps.
- [Upgrading](docs/upgrading.md): moving a project to a new version, in the right order.
- [How it works](docs/how-it-works.md): the idea, and a real run from idea to merged pull request.
- [Commands](docs/commands.md): the nine commands, and the skills that `think` uses.
- [Configuration](docs/configuration.md): the `relevo.yml` file.
- [Stacks and platforms](docs/stacks.md): declare your platforms and add your own rules.
- [Where `go` runs](docs/execution.md): the cloud, your machine or both, and the two credentials.
- [Guide](docs/guide.md): what to do next, and what to do when something goes wrong.
- [Security model](docs/security.md): what Relevo protects and what it does not.
- [All the documentation](docs/README.md): reference, how it was built, and the brand.

## Acknowledgements

Relevo builds on [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [mattpocock/skills](https://github.com/mattpocock/skills), both MIT licensed. Their notices are in [NOTICE](NOTICE).

## License

[MIT](LICENSE) for the software and the documentation. The Relevo name and logo are not covered by it: see [TRADEMARKS.md](TRADEMARKS.md).
