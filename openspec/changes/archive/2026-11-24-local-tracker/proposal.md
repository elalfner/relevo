# Proposal

## Why

Relevo's build and review engine (the spec, the build in groups, the validation gate, the five QA lenses) is useful for a small functional prototype, but today a person cannot use it without a GitHub repository: the issue, its lifecycle labels, the approval, the pull request and the merge all live on GitHub. For one developer who wants to try an idea quickly, creating a remote repository, labels, rulesets and secrets is more work than the idea. `relevo.yml` already reserves the place for another tracker (`tracker: github  # more later`), and the build already tolerates a branch that cannot be pushed (`not_pushed`), so the missing piece is the tracker itself.

A second, smaller gap goes with it: a prototype does not need the same depth of questions and spend as a long-lived product, but the project today has one depth. The QA lenses must not be weakened for that (no lens can be turned off or lowered, by design), so the depth has to move only cost and conversation.

## What Changes

- **New tracker `files`** for one person working on a local git repository with no remote. An issue is a markdown file under `.relevo/issues/` with the same sections that `/relevo:issue` writes and `check-issue` validates today. Its lifecycle state, approval hash and comments are kept beside it on this machine and are not committed, so a state change never creates a commit on the base branch.
- **`/relevo:issue`, `/relevo:go`, `/relevo:fix`, `/relevo:review`, `/relevo:ship` and `/relevo:status` work through one tracker entry point** instead of calling `gh` inline. With `tracker: github` they behave exactly as today; with `tracker: files` they read and write the files.
- **Local delivery.** With the `files` tracker there is no pull request: `/relevo:review` reviews the branch diff and records its result, and `/relevo:ship` archives the specification and merges the branch into the base branch locally, after the person's written confirmation, as it asks today.
- **`/relevo:init --local`** creates the git repository when there is none, a minimal `relevo.yml` for a single person and the `.relevo/` folder, and asks for nothing from GitHub. `/relevo:doctor` checks what a local project needs and does not report the GitHub checks as failures.
- **New setting `depth`** in `relevo.yml` with the values `prototype` and `standard` (default `standard`, which is what Relevo does today). It sets the defaults of the effort and model of `dev` and the lenses, and how many questions `/relevo:think` asks. All five lenses run at every depth, the model floor of the lenses stays, and a value written under `agents.*` wins over the depth. The person is never asked for the depth per issue.
- A project that has `tracker: github` changes nothing. Mixing the two (`tracker: files` with a GitHub provider, or the reverse) is rejected by validation.

Out of scope: more than one person on a `files` project (identity, claims, a queue), the cloud workflows, migrating a `files` project to `github`, a `deep` depth, and turning off or lowering any QA lens.

## Capabilities

### New Capabilities
- `local-tracker`: an issue as a file, its state, approval hash and comments kept on this machine, and the rules that make a `files` project behave like a one-person GitHub project.
- `local-delivery`: reviewing and shipping a built issue without a pull request: a diff review recorded locally and a confirmed local merge into the base branch.
- `project-depth`: the `depth` setting, what each value sets, and the guarantee that no depth removes or weakens a QA lens.

### Modified Capabilities
- `configuration`: `tracker` and `git_provider` accept the new values, the pair must agree, and `depth` is a new setting.
- `init-doctor`: `init --local` and a `doctor` that checks a local project.
- `issue`: `/relevo:issue` writes the issue file when the tracker is `files`.
- `go`: the issue is read, claimed and updated through the tracker, and a branch with no remote is a normal case.
- `think`: the number of questions follows `depth`.
- `status`: the issues of a `files` project are listed from the files.

## Impact

- Code: a new tracker entry point (`scripts/tracker.mjs` and `scripts/lib/tracker/`) with a `github` backend that delegates to what exists and a `files` backend; the 16 scripts and the skills that call `gh issue` or `gh pr` inline move to it; `config.mjs` (enums and `depth`), `model-plan.mjs` (depth defaults), `init`/`doctor` plans, `templates/relevo.yml`.
- Tests: the `github` path keeps its current tests; the `files` path gets its own, and a test checks that no skill or script outside the tracker calls `gh issue` or `gh pr`.
- Docs: `docs/configuration`, `docs/commands`, `docs/get-started` and `docs/issue-format` (English and Spanish, which the readme-sync test keeps in step) and `CHANGELOG.md`. The version in `.claude-plugin/plugin.json` is raised on `dev` at release time, as usual.
- Systems: none outside the repository. No new dependency.
- Open changes `go-visibility` and `build-runner-labels` touch the same lifecycle and runner code and should be archived first.
