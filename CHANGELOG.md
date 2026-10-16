# Changelog

All notable changes to Relevo are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-15

The first release. It covers the whole cycle for one person, from an idea to a merged pull request, on a Flutter Android project hosted on GitHub.

### Added

- **Commands**, as a Claude Code plugin named `relevo`: `init`, `doctor`, `think`, `create`, `go`, `review`, `fix`, `ship` and `status`.
- **Agents** `dev` and `qa`: the developer implements a specified change and the QA agent audits it, read-only, against the specification and the project rules.
- **Workflows** to copy into a repository: `go` (a light `decide` job that runs the gates and claims the issue, then a `build` job that runs the agent), the queue, the review events, the review SLA reminder and the daily digest.
- **The issue lifecycle**: eleven labels, hand-off messages in English and Spanish, one message per hand-off, and a work-in-progress limit per person.
- **`relevo.yml`**: one configuration file per repository, validated, with defaults.
- **Documentation that travels in the issue**: the glossary entries and decision records settled while thinking go in a `Documentation` section of the issue, are written by `go` in the same pull request as the feature, and are checked by QA.
- **Security**: issue text treated as data, a closed tool list with no web access for the unattended agent, a `trust` level, a ruleset that keeps the agent on `feature/*` branches, and the verified inputs of the agent runner (see `docs/action-parameters.md`).
- **Verification of the project itself**: acceptance tests that run the real scripts, a structure test for every skill, agent and template, and a CI workflow.
- **Documentation** in English and Spanish, the findings of two pilots in `docs/pilot-findings.md`, and the design and specifications in `openspec/`.

### Known limits

- Only the one-person path has run on GitHub and on a real device. Approval by a second person, the `peer` and `roles` review modes, the review reminder and escalation, the review events and the reviewer selection are covered by tests only. A team that uses them may find problems; they will be corrected in a later release.
- Platform: Android with Flutter. Tracker and Git provider: GitHub.
- Branch protection and rulesets need a public repository or a paid plan on GitHub. Without them, approving and merging are enforced only by the written confirmation that `ship` asks for.
- The plugin works together with tools it does not bundle: the OpenSpec command line, `git`, the GitHub CLI and, for `think`, the skills of OpenSpec and mattpocock/skills. `doctor` reports what is missing and `init` offers to install it.
