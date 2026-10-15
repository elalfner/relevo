# Relevo

**An automatic issue-to-merge workflow where an agent builds and people verify.**

English · [Español](README.es.md)

> *Relevo* is Spanish for "relay". Every step of the workflow is a handoff: the agent passes the baton to a person, and that person passes it to a peer.

> **Status: early development.** All the commands below exist. The solo cycle (`go`, `review`, `ship`) has run once on a real repository and a real Android device; the team features (peer review, review reminders and escalation, reviewer selection) are covered by tests only and have not run against a live team yet. See [pilot findings](docs/pilot-findings.md).

## Install

Relevo is a Claude Code plugin. In a terminal:

```bash
claude plugin marketplace add elalfner/relevo
claude plugin install relevo@relevo
```

Restart Claude Code in your project and run `/relevo:doctor` to see what is still missing. While the repository is private you need read access to it (the first command clones it over SSH).

Relevo works together with a few tools it does not bundle: the [OpenSpec](https://github.com/Fission-AI/OpenSpec) command-line tool, `git`, the GitHub CLI (`gh`), the toolchain of your platform and, for `think`, the skills listed [below](#skills-that-think-uses). `/relevo:init` offers to install what is missing, one command at a time.

## The idea

Writing code is no longer the slow part. Verifying it is. Relevo puts the agent where it is fast (building and self-checking) and puts people where they are irreplaceable (testing on a real device, reviewing a peer's work, deciding to merge).

```
 spec writer        agent (cloud)           assignee              peer
 ready issues ───►  build + QA     ───►  review on device ───►  approve + merge
 in a milestone     no human wait         fix, open PR          then close the loop
```

- **Specs first.** Detailed, spec-ready issues are the input. The agent builds against them and QA checks the diff against them.
- **Pull, not push.** A work-in-progress limit per person keeps the agent from burying the team in unreviewed branches.
- **Humans decide.** Approving and merging are explicit human acts, enforced by branch protection, never by a prompt alone.
- **Every handoff is one message** that says what happened, what is expected of you, and which command to run next.

## See it work

A real run on the [sandbox](https://github.com/elalfner/relevo-sandbox), a small Flutter app, for [issue #5](https://github.com/elalfner/relevo-sandbox/issues/5), "Show the build number". One person played every role.

| Step | The person | Relevo | Time |
|---|---|---|---|
| 1 | thinks the idea through (the exploration and grilling that `/relevo:think` runs) and approves the issue text | explores the code, asks until every decision is made, and drafts the issue: scenarios, edge cases and the new vocabulary in a `Documentation` section | a conversation |
| 2 | labels the issue `relevo:ready` | the light `decide` job runs the gates and claims the issue | 17 s |
| 3 | nothing | the `build` job writes the specification, the code and the tests, and QA checks them | 3 min 35 s |
| 4 | reads the hand-off and runs `/relevo:review 5` on a phone | captures screens, audits the log, opens the [pull request](https://github.com/elalfner/relevo-sandbox/pull/16) | a few minutes |
| 5 | runs `/relevo:ship 5` and confirms | merges, archives the specification, closes the issue | seconds |

The hand-off the agent left on the issue, shortened:

```
@elalfner #5 "Show the build number" is built ✅

What happened: 11 of 11 tasks done, QA passed.
Branch: feature/5-show-the-build-number
What to test: 8 scenarios (checklist below)
Riskiest area, check it first: The real build number from an APK through the
Android package_info_plus plugin (tests only use the mock), and how the two
texts look on a small physical device.
Your next step: /relevo:review 5
```

The glossary entries that came out of the conversation travelled in the issue and arrived in the same pull request as the feature, so nobody committed documentation by hand. Peer review, reminders and reviewer selection need a second person and were not part of this run.

## Commands

Distributed as a Claude Code plugin named `relevo`:

| Command | What it does |
|---|---|
| `/relevo:init` | Sets up config, labels, branch protection and workflows (idempotent, shows a plan first) |
| `/relevo:think` | Prepares the context before any issue exists: it runs the `openspec-explore` skill and then the `grill-with-docs` skill, one after the other, in the same conversation. The skills do the work; `think` only chains them and hands off to `create`. It writes no files: the glossary entries and decision records it settles travel in the issue's `Documentation` section, so nobody has to commit them by hand |
| `/relevo:create` | Turns an idea into issues that pass the spec check: asks only what is missing, checks, shows, then creates (never starts a build) |
| `/relevo:go` | Builds a ready issue: spec check, build, QA with one retry (runs automatically in the cloud) |
| `/relevo:review` | Guided on-device review: the person drives, the agent captures and audits logs |
| `/relevo:fix` | Fixes review feedback, updating the spec first |
| `/relevo:ship` | Verifies approval, archives the spec, merges, closes the loop |
| `/relevo:status` | Who is waiting on what, plus a daily digest |
| `/relevo:doctor` | Checks that the environment and repo settings are correct |

## Configuration

One `relevo.yml` per repository: branches, reviewers, work-in-progress limits, evidence policy, labels, language.

## Built with OpenSpec and mattpocock/skills

Relevo was specified and built the way it asks you to work: with [OpenSpec](https://github.com/Fission-AI/OpenSpec) (MIT licensed), spec first, then code, then the pilot.

- The design lives in `openspec/`. [`changes/relevo-v1`](openspec/changes/relevo-v1) holds the proposal, the design decisions (D1 to D16, each with the alternatives that were rejected), twelve specifications and the task list. Later changes, such as `glossary-travels-with-the-issue`, follow the same path, and finished ones are archived under `openspec/changes/archive/`.
- The history shows how it grew: the commits and pull requests, and the two pilots written up in [docs/pilot-findings.md](docs/pilot-findings.md), including what failed and how it was fixed. The [sandbox](https://github.com/elalfner/relevo-sandbox) is a small Flutter app where the whole cycle ran, and it is still there to read.
- The thinking was done with the skills of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT licensed), the same ones that `/relevo:think` runs for you.

OpenSpec and those skills are also what the plugin works with: `think` runs them, and `go` and `ship` use the OpenSpec command line to write and archive the specification of each issue. The copies this repository keeps are development tooling and are not part of the plugin (see below).

## Skills that `think` uses

`/relevo:think` does not reimplement anything: it runs two existing skills directly, so their behaviour is exactly theirs.

| Skill | Comes from | Role in `think` |
|---|---|---|
| `openspec-explore` | [OpenSpec](https://github.com/Fission-AI/OpenSpec) (`openspec init`) | explores the idea and the code |
| `grill-with-docs` | [mattpocock/skills](https://github.com/mattpocock/skills) | interviews you until every decision is made; the glossary and decision-record entries it settles are handed to `create`, not written |
| `grilling`, `domain-modeling` | [mattpocock/skills](https://github.com/mattpocock/skills) | used by `grill-with-docs` |

The plugin does not contain them: what `/plugin install` copies is `skills/`, `agents/` and `templates/`. Install them in your project (`openspec init`, and `npx skills add mattpocock/skills`); if one is missing, `think` stops and says which.

This repository does keep copies for working on it: the OpenSpec skills and commands under `.claude/` (generated by OpenSpec 1.14.1; refresh them with `openspec update`) and the skills from mattpocock/skills under `.agents/skills/`, linked from `.claude/skills/` (installed with `npx skills add`, pinned in `skills-lock.json`). Their licence notices are in [NOTICE](NOTICE).

## Acknowledgements

Relevo builds on [OpenSpec](https://github.com/Fission-AI/OpenSpec) and [mattpocock/skills](https://github.com/mattpocock/skills), both MIT licensed. Their notices are in [NOTICE](NOTICE).

## License

[MIT](LICENSE)
