# Proposal

## Why

Every Relevo workflow template has `runs-on: ubuntu-latest` hard-coded, and nothing in `relevo.yml`, `init`, `doctor` or the docs mentions another runner. A project that runs its Actions on a self-hosted runner has to edit each workflow by hand (a real project does: `runs-on: [self-hosted, linux-build]` in five files). That edit is invisible to Relevo, so a regenerated or newly added workflow (the ship workflow, for instance) goes back to `ubuntu-latest`, and `doctor` cannot tell whether the runner is the one the team meant.

A self-hosted runner is also usually persistent: the same machine and home folder serve every job. The templates assume a disposable GitHub-hosted VM. They install OpenSpec globally with no version, and the Antigravity step writes `~/.local/bin/agy` and a user-level settings file, so a persistent runner accumulates state and drifts between runs.

## What Changes

- New `relevo.yml` key `runner.labels`: a list of runner labels for every Relevo workflow. Absent means `ubuntu-latest`, so nothing changes for current setups.
- `/relevo:init` writes the labels into the workflows it generates and keeps them when it rewrites a workflow. `/relevo:doctor` fails when a Relevo workflow's `runs-on` differs from `runner.labels`, and says once that a self-hosted runner is assumed to persist.
- The workflow templates stop depending on a disposable VM, with no setting for it. They install OpenSpec in `$RUNNER_TEMP` at a pinned version instead of globally, keep the Antigravity binary and settings under `$RUNNER_TEMP` instead of `$HOME`, and end each job with a step that always runs and removes what they put in the workspace. On a GitHub-hosted runner this changes nothing observable.
- The workflows state the tools they assume on the runner (`gh`, `jq`, `git`, Node), and the toolchain check also covers them.
- `docs/execution.md` and `docs/security.md` (English and Spanish) gain a section on self-hosted runners: how to set the labels, that Relevo assumes persistence, and that the agent's code runs with the runner user's permissions, so an ephemeral runner or a container is the real barrier.
- Out of scope: a `runner.ephemeral` key (Relevo cannot verify it, and one cleaning path works for both), per-job runners, runner groups, and any control over how many runners exist.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `configuration`: a requirement for the `runner.labels` setting, its default and its validation.
- `go`: a requirement that a build leaves nothing behind on the runner and installs its tools in the job's temporary folder.
- `init-doctor`: `init` renders and preserves the runner labels; `doctor` checks them against the workflows and reports a self-hosted runner.

## Impact

- Code: `scripts/lib/config.mjs` (the setting), `scripts/lib/init.mjs` and `scripts/lib/agent-workflow.mjs` (render the labels into the templates), `scripts/lib/doctor.mjs` (the check and the note), `scripts/toolchain-check.mjs` and the profile data it reads (generic tools).
- Templates: `templates/workflows/relevo-*.yml` and `templates/agents/antigravity-step.yml`.
- Docs: `docs/execution*.md`, `docs/security*.md`, `docs/configuration*.md`, `CHANGELOG.md`.
- Tests: the workflow template tests (`tests/workflow-go.test.mjs`, `tests/workflow-package.test.mjs`, `tests/workflow-ship.test.mjs`, `tests/template.test.mjs`) assert the text of the templates and need the new `runs-on` and install lines.
- Release: the version and the pinned `RELEVO_VERSION` follow the release process, outside this change.
- Nothing is breaking: a repository without `runner` behaves as before.
