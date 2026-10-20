# Changelog

All notable changes to Relevo are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Scripts** that hold the rules `go` must not vary: `preflight`, `issue-hash`, `branch-state`, `spec-ready`, `intent-to-add`, `commit-change` and `next-step`, plus the protected-paths and OpenSpec-command tables they and the tests share.
- **`Allow-paths:` line** (optional) in the issue format: the dependency files a change may touch. The files that control the workflow (`.github/`, `relevo.yml`, `.relevo/`, skills, the project rules file) can never be listed.

- **Platform registry**: `platforms` in `relevo.yml` (stack, folder and targets of each platform); the older `platform: flutter-android` still works as one Flutter platform for Android.
- **Stack profiles** (`stacks/<stack>.md` in the plugin, starting with `flutter`): the commands that verify the code, the generated files left out of the diff, the tools, the targets and the typical bugs, in one file. A repository adds to a profile with `.relevo/stacks/<stack>.md` and replaces a command only with `platforms.<name>.checks`.
- **Extra skills per role** (`dev`, `qa`, `issue`, `review`), resolved from the base branch by `scripts/role-skills.mjs`; a skill with scripts is used only when `skills.allow_scripts` names it. `doctor` lists the skills left out, warns over 20 KB per role and compares each skill with `skills-lock.json`.
- **Documentation**: [Stacks and platforms](docs/stacks.md), in English and Spanish.

### Changed

- **Agents `dev` and `qa` are generic**: the Flutter text moved to the Flutter profile, and `go` hands them the resolved profile. They do not edit `relevo.yml`, `.relevo/` or `skills-lock.json`, and `qa` rejects a diff that touches them.
- **`qa.rules_from`** accepts a list of files; every listed file is protected. `skills-lock.json` is a protected path.
- **`doctor`** reads the toolchain and the targets from the profile of each platform. The checks `tools.toolchain` and `tools.device-bridge` are now `tools.<tool>` (for example `tools.flutter`) and `tools.target.<platform>.<target>`.
- **`init`** asks for the platforms (name, stack, folder, targets) and writes `platforms`; it can create a commented `.relevo/stacks/<stack>.md`, which it never commits.
- **`go` with several platforms** does not start: it removes `ready` and comments, until the issue can name its platform.
- **`go` is hardened**: it checks that the issue text is the one that was approved (hash), refuses protected paths and temporary markers or credentials in what it commits, never touches a branch that already exists (the comment says how to recover, by its content), reads the progress of the build from `openspec instructions apply`, uses only a closed list of OpenSpec commands, and ends every comment with the next step from one table in English and Spanish.
- **Agents `dev` and `qa`** run only `openspec status` and `openspec instructions apply`; QA reviews the diff of the working tree against `origin/<base>`, and on a retry still runs analysis and all tests.
- **Workflow template**: copy `relevo-go.yml` again to get the new wording of the final step (a run can be cut at its turn or cost limit) and the install examples without package scripts.

- **`create` is now `issue`**: `/relevo:create` is gone, with no alias, and `/relevo:issue` replaces it. Without an argument it writes new issues exactly as before; with an issue number it updates the description of an existing one.

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
