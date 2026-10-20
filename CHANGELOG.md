# Changelog

All notable changes to Relevo are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Where `go` builds** is derived, not configured: from the workflows that are installed, the model secret that exists and the new repository variable `RELEVO_CLOUD_GO` (`off` pauses the cloud at once, with no pull request; the queue pauses with it). A cloud without a credential no longer fails: the issue stays `ready` and a comment says to run `/relevo:go <n>` on a machine or to add the secret. See [Where `go` runs](docs/execution.md).
- **`go-local.mjs <issue>`** (and `/relevo:go <n> --local`) builds an issue on a person's machine, in a separate git worktree, with the same turn and cost limits and the same closed tool lists as the workflow (written once in `scripts/lib/run-flags.mjs` and compared with the template by a test).
- **Two credentials**: `doctor` deduces `api_key` or `subscription` from the secret name, warns when both exist, shows the state of the pause variable, reminds to read Anthropic's current terms for a subscription, and warns when a subscription is used with more than one concurrent agent. `init` asks where `go` runs and with which credential, switches the credential line of the workflow and sets `concurrent_agents` to 1 for a subscription.
- **After each cloud run** a comment gives the turns, the cost (notional with a subscription) and the tokens read from the agent's execution log, when it has them; a run that stopped at a usage limit or an empty credit says so and tells you to label the issue `ready` again later. The log format and the limit messages are not documented, so both readers are tolerant and say nothing when unsure.
- **`status`** lists the `ready` issues assigned to you with `/relevo:go <n>` when the cloud is not building, and alerts about an issue stuck on `building` (`limits.building_alert_hours`, default 3).
- **Dependencies between repositories**: `Depends-on: owner/repo#N` names an issue of another repository, and the new `links` setting of `relevo.yml` is the closed list of repositories an issue may depend on. The gate waits until the other issue is closed as completed, notices on the queue's schedule, and reads private repositories with a read-only token stored as the secret `RELEVO_LINKS_TOKEN` (public ones need none). An issue that names a repository outside `links`, or whose dependency cannot be read, says so instead of building.
- **`status`, `doctor` and `init` know the links**: `status` shows what a blocked issue waits for in another repository and its state; `doctor` checks that each linked repository can be read and that the secret exists (its name only); `init` asks for `links` and reminds about the secret.
- **`issue` drafts the other side**: when a feature depends on work in a linked repository it drafts that issue, shows it whole, creates it there only if asked, and offers to reuse the `## Data contract` of the issue it depends on.
- **`Platform:` line** in the issue: an issue names the one platform it is for (required with several platforms in `relevo.yml`, optional with one). `go` resolves it, passes the platform, stack and folder to the agents, and a draft without it fails the check. `fix` and `review` find the platform again with the new `platform-of.mjs`.
- **Scope of a commit**: `commit-change.mjs --within <folder> --change <id>` refuses files outside the folder of the platform (the change's specification, `GLOSSARY.md`, `docs/adr/` and `Allow-paths:` aside); the reason is "outside the platform".
- **Scripts** that hold the rules `go` must not vary: `preflight`, `issue-hash`, `branch-state`, `spec-ready`, `intent-to-add`, `commit-change` and `next-step`, plus the protected-paths and OpenSpec-command tables they and the tests share.
- **`Allow-paths:` line** (optional) in the issue format: the dependency files a change may touch. The files that control the workflow (`.github/`, `relevo.yml`, `.relevo/`, skills, the project rules file) can never be listed.

- **Platform registry**: `platforms` in `relevo.yml` (stack, folder and targets of each platform); the older `platform: flutter-android` still works as one Flutter platform for Android.
- **Stack profiles** (`stacks/<stack>.md` in the plugin, starting with `flutter`): the commands that verify the code, the generated files left out of the diff, the tools, the targets and the typical bugs, in one file. A repository adds to a profile with `.relevo/stacks/<stack>.md` and replaces a command only with `platforms.<name>.checks`.
- **Extra skills per role** (`dev`, `qa`, `issue`, `review`), resolved from the base branch by `scripts/role-skills.mjs`; a skill with scripts is used only when `skills.allow_scripts` names it. `doctor` lists the skills left out, warns over 20 KB per role and compares each skill with `skills-lock.json`.
- **Documentation**: [Stacks and platforms](docs/stacks.md), in English and Spanish.

### Changed

- **`doctor` no longer fails when no model secret exists**: the cloud cannot build, but a local build can, so it warns. Copy the `go` and queue workflows again to get the pause variable, the credential check and the new report steps.
- **`Depends-on: acme/api#12` is no longer read as issue 12 of this repository.** Until now every `#number` of a `Depends-on:` line was taken as local, which could unblock the wrong issue. Copy the workflows again to get `GH_LINKS_TOKEN` in the gate and the queue.
- **`go` with several platforms** builds the platform the issue names instead of refusing; an issue that does not name a valid platform goes to `needs-spec` with the list of platforms. The decision `platform` and its message of the previous release are gone.
- **`fix` commits through `commit-change.mjs`** (protected paths, scan and the platform folder in one step) instead of staging and scanning by hand.
- **The `go` workflow template** exposes `platform`, `stack` and `path` from the `decide` job, and its setup examples are guarded by the stack (Flutter, Vue, Laravel); copy `relevo-go.yml` again to get them.
- **Agents `dev` and `qa` are generic**: the Flutter text moved to the Flutter profile, and `go` hands them the resolved profile. They do not edit `relevo.yml`, `.relevo/` or `skills-lock.json`, and `qa` rejects a diff that touches them.
- **`qa.rules_from`** accepts a list of files; every listed file is protected. `skills-lock.json` is a protected path.
- **`doctor`** reads the toolchain and the targets from the profile of each platform. The checks `tools.toolchain` and `tools.device-bridge` are now `tools.<tool>` (for example `tools.flutter`) and `tools.target.<platform>.<target>`.
- **`init`** asks for the platforms (name, stack, folder, targets) and writes `platforms`; it can create a commented `.relevo/stacks/<stack>.md`, which it never commits.
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
