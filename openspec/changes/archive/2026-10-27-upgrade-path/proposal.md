# Proposal

## Why

A project that stays on an old version of Relevo has no way to move up that is written down or checked. Three things carry a version and each is updated somewhere else: the plugin on each person's machine, the pin `RELEVO_VERSION` in the workflows, and the plugin that the cloud agent loads. Today the third is not tied to the project: the workflows add the marketplace `elalfner/relevo` and install `relevo@relevo`, whose entry names the npm package with no version, so a cloud run takes the latest published plugin (Claude Code fetches `latest` when an npm source has no version) while its scripts come from the pinned package. A project that pins 0.5.0 runs 0.5.0 scripts with a newer plugin.

The text of the workflows has no way to move either. `/relevo:init` never overwrites a workflow that differs and only says `differs`, and the pin is a number that a person can change with `sed` without touching the text. A real project is an example: its workflows are the 0.5.0 text (4 lines differ, all its own credential choice) with the pin raised to 0.7.0 by hand. And `doctor` reports one version, that of the plugin that runs it, so it cannot say that the machine and the project are on different ones.

## What Changes

- **The cloud agent loads the plugin from the package the job already unpacked at the pinned version** (`--plugin-dir`), not from a marketplace. One pin, `RELEVO_VERSION`, then decides the scripts and the skills; the workflow stops adding the marketplace and no longer needs a token to read the plugin repository. This depends on a check made first (see Impact); if the action does not forward the option, the fallback in design.md is used instead.
- **`/relevo:init` updates a workflow that differs, by a three-way merge**: the base is the published template closest to the file, "yours" is the file, "theirs" is the current template. A clean merge is shown in the plan and written on confirmation; a conflict writes nothing and shows the conflicting lines. The pin and a new stamp are not merged: they are set to the current version.
- **Each template carries the version of its text** (`# relevo-template: X.Y.Z`), so a workflow whose text is older than its pin can be told apart from one that is current.
- **`doctor` reports the versions it can read without the network**: the plugin in use, each installed scope (`claude plugin list --json`), the pin of the workflows on the default branch and the version of their text, and warns when they differ, with the command that fixes each.
- **An upgrade page**, in English and Spanish, with the order that avoids breaking a project (older readers reject the keys a newer `relevo.yml` adds), and how to read the versions.
- `RELEASING.md` and the release requirement say the real reason for publishing before promoting: the templates on `main` pin a version that has to exist.
- Out of scope: asking the npm registry for the latest version, making `relevo.yml` validation tolerant of unknown keys, a different plugin per project on one machine, and reusable workflows (the toolchain and dependency steps of a project cannot be injected into a called workflow).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-distribution`: the runner installs the plugin for the agent from the pinned package too; the cloud agent loads it from there; each template carries the version of its text; the release requirement states the right reason.
- `init-doctor`: `init` updates a workflow by a three-way merge; `doctor` reports the versions and the age of the text of a workflow; the check of `RELEVO_PLUGIN_TOKEN` applies only to a workflow that still uses the marketplace.
- `documentation`: the upgrade page.

## Impact

- Code: `templates/workflows/relevo-go.yml` and its Claude agent block, the other five templates (the stamp), `scripts/lib/init.mjs` and a new module for the merge, `scripts/lib/doctor.mjs`, `scripts/init.mjs`, `scripts/cli.mjs`.
- Docs: a new `upgrading` page, `install`, `execution`, `security`, `commands` and `get-started` in both languages, `docs/action-parameters.md` (English only), `RELEASING.md`, `skills/init/SKILL.md`, `CHANGELOG.md`.
- Tests: the workflow template tests, `tests/init.test.mjs`, `tests/doctor.test.mjs` and `tests/docs-claims.test.mjs` (the new page joins its list).
- **Checks before building**, made first because the design depends on them: that `claude-code-action` forwards `--plugin-dir` and that the skills keep the name `/relevo:go`; and that `git merge-file` merges the real case (a project that uses Relevo) cleanly and reports a conflict as one.
- Release: a minor version. A project keeps working untouched: its old workflows still use the marketplace until `init` updates them.
