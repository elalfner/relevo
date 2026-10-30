# Proposal

## Why

A label event runs the workflows of the repository's default branch, and those workflows check out that branch, so the cloud reads `relevo.yml` from the default branch too. When the default branch is the release branch (`main`) and the team works on the base branch (`dev`), a change to `relevo.yml` on `dev` (a limit, a runner, a platform) does nothing in the cloud until the next promotion, and nothing says so. The documentation says the workflows must be on the default branch, but not that `relevo.yml` is read from there, and not that the branch of a build always starts from `origin/<branches.base>` whatever the default branch is. A person who finds `main` as the default branch cannot tell from the pages whether `go` branches from `main` or from `dev`.

## What Changes

- `doctor` reads `relevo.yml` from the default branch and from the base branch on GitHub and warns when the two settings differ, or when the default branch has no `relevo.yml` while the base branch has one. The fix says to promote the base branch, or to make the base branch the default branch. Nothing is compared when the default branch is the base branch, or when the repository cannot be read.
- The page "Where `go` runs" (English and Spanish) gains a section that says which branch the cloud reads its workflows and `relevo.yml` from, that the branch of a build always starts from `origin/<branches.base>` in the cloud and on a machine, and what changes when the base branch is made the default branch.
- The `branches.base` row of the configuration page (English and Spanish) says that every build branch starts from it and that its pull request targets it.
- A changelog entry under Unreleased.

## Capabilities

### New Capabilities

### Modified Capabilities

- `init-doctor`: `doctor` compares the `relevo.yml` the cloud reads (default branch) with the one on the base branch and warns when they differ.
- `documentation`: the execution page states where the cloud reads its configuration and where a build branch starts.

## Impact

- `scripts/lib/doctor.mjs` (`gatherFacts`, `runChecks`) and `tests/doctor.test.mjs`.
- `docs/execution.md`, `docs/execution.es.md`, `docs/configuration.md`, `docs/configuration.es.md`, `CHANGELOG.md`.
- No change to the workflows, the templates, `go` or `relevo.yml`. `doctor` stays read-only and makes two more read calls to the contents API.
- Out of scope: changing the default branch for the user (`init` does not offer it), comparing other files between the two branches, and a release: the check ships with the next version of the plugin.
