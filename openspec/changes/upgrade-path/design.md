# Design

## Context

- A Claude build gets its plugin through the model action: `plugin_marketplaces: https://github.com/elalfner/relevo.git` and `plugins: relevo@relevo` (`templates/workflows/relevo-go.yml`, inside the block `relevo:agent-step`). The marketplace file `.claude-plugin/marketplace.json` lists the plugin with `source: { source: npm, package: @elalfner/relevo }` and no version; Claude Code's reference says an npm source without `version` fetches `latest`. The scripts of the same run come from the package that the job unpacks at `RELEVO_VERSION` into `$RUNNER_TEMP/relevo` (step "Check the toolchain"). Antigravity already renders its plugin from that unpacked package.
- A marketplace serves one version of a plugin at a time, and a user registers one marketplace per name. `claude plugin list --json` gives, per installation, `id`, `version`, `scope` and `projectPath`; the cache keeps one folder per version.
- `init` plans each workflow as `todo`, `ok` or `differs` and never overwrites one that differs. The published packages 0.5.0 to 0.8.0 are on npm with `templates/workflows/` inside, so the text of an old template can be fetched.
- `viali_panel_vue`: the workflows are the 0.5.0 text with the pin raised to 0.7.0 by `sed`; against the 0.5.0 template `relevo-go.yml` differs in 4 lines (its credential choice) and the other four workflows in none.
- `doctor` reads the plugin version of the process that runs it (`f.pluginVersion`) and compares it with the pins.

## Goals / Non-Goals

**Goals:**
- One pin decides the scripts and the skills of a cloud run.
- A project can move its workflows to the current text without losing its own edits, and is told when it should.
- A person can see, without leaving `doctor`, which version each part is on.

**Non-Goals:**
- The npm registry's latest version: nothing here calls the registry except the fetch of an old template when `init` needs a base.
- Making an old reader tolerate new keys of `relevo.yml` (the order in the guide covers it).
- A different plugin version per project on one machine (the cache and the marketplace name are per machine).
- Reusable workflows: the toolchain, the dependency installs and the credential line are the project's own, and a called workflow cannot take steps from its caller.

## Decisions

### D1. The Claude agent loads the unpacked package with `--plugin-dir`

The model step gets `--plugin-dir ${{ runner.temp }}/relevo` in `claude_args`, and loses `plugin_marketplaces` and `plugins`. The folder is the package the job already unpacked, outside the workspace, so the agent still finds a clean working tree. The pin then governs the skills as well, and the marketplace, the clone of the plugin repository and `RELEVO_PLUGIN_TOKEN` (the pilot's finding F1) are gone from the cloud path. The Antigravity block already works this way.

Fallback, if the action does not forward the option (task 1.1): keep the marketplace and pin it. `plugin_marketplaces` accepts a URL with `#vX.Y.Z` (the reference documents `#ref` for `marketplace add`) and the `marketplace.json` of each release tag names `@elalfner/relevo@X.Y.Z`, written by the release steps before tagging. It needs the action to pass the ref through and a release step more.

Alternative: pin the entry in the `marketplace.json` of `main`. Rejected: a marketplace serves one version at a time, so every project would get the same one, and a project on 0.5.0 gains nothing.

### D2. A three-way merge with the published templates as the base

The base is not the pin (a person can raise it by hand): it is the published template, among the versions that carry templates, with the fewest differing lines against the file once the pin, the stamp and the runner are set aside. `init` fetches candidates with `npm pack @elalfner/relevo@<v>` into a temporary folder, as the workflows do, and keeps none of them. The merge is `git merge-file -p`, on temporary files; `git` is already required. "Theirs" is the current template rendered with `runner.labels` and `agent.build` (as `init` renders a new workflow today), so a person's runner or Antigravity block is the same on both sides and raises nothing. The credential line is not rendered: the person's choice is an edit against the base and survives.

The pin and the stamp are written after the merge, not merged, because the person's pin differs from the base on purpose. After a clean merge `init` checks the structure that other code depends on: one `RELEVO_VERSION`, one stamp, and the markers `# relevo:credential` and `# relevo:agent-step` begin and end once each when the template has them. A merge that fails this is treated as a conflict. On a conflict nothing is written: the file would not be valid YAML.

The change is written in the working tree, and the person commits it on a branch and opens the pull request. `doctor` judges the default branch, and a workflow runs only from there.

Alternative: regenerate the workflow from the template and the answers. Rejected: it loses edits it cannot know about. Alternative: tell the person to diff by hand. Rejected: that is today.

### D3. The stamp is a comment line

`# relevo-template: X.Y.Z` is the first comment line of each template, equal to the package version, and a test fails when they differ (the same guard as the pin and the manifest). It is separate from the pin because the pin can be moved by hand. `doctor` warns when the stamp is older than the pin or missing.

### D4. Versions come from `claude plugin list --json` and the workflows

`doctor` lists the installations of `relevo@relevo`, with scope and, for a project scope, its path; keeps those that are user scope or the project scope whose path is the repository; and compares them with the plugin in use and with the pins of the workflows on the default branch. If `claude` is missing or fails, one warning and the rest runs. It reads no file of Claude Code's own cache, only the command.

### D5. The credential check follows the workflow

`automation.plugin-secret` and `automation.plugin-clone` apply only when a workflow on the default branch still names a marketplace. After the update they disappear for that project.

### D6. An upgrade page, with the order

The order of the guide: plugins on the machines (safe in any order, a newer plugin reads an older `relevo.yml`); then one pull request with the workflows to the default branch; then `init` for the labels and the workflows that are new; then the new keys of `relevo.yml`. The reason for the last step is in `configuration`: an unknown key is an error to an older reader.

## Risks / Trade-offs

- [The action does not forward `--plugin-dir`] → task 1.1 checks it first; D1's fallback keeps the marketplace and pins it by tag.
- [The skills load under another name with `--plugin-dir`] → task 1.2 checks `/relevo:go` before the templates change.
- [`git merge-file` merges text that is valid but wrong] → the structural check, the difference shown in the plan, the confirmation and the pull request.
- [Fetching old templates needs the network at `init`] → it already needs `gh`; if `npm pack` fails, the workflow is left as it is and the message says why.
- [An old project updates its workflow and the new text needs a newer `relevo.yml` key] → the update does not add keys; the templates read the same file.
- [A project whose workflows are not updated keeps the marketplace route] → it works as today, and `doctor` says the text is older than the pin.

## Migration Plan

1. Release as a minor version. A project that does nothing keeps its workflows and the marketplace route.
2. A project follows the upgrade page: plugins, then the workflow pull request produced by `init`, then the new keys.
3. Rollback: the pull request is the unit; reverting it returns the old text, and the marketplace route still works because the marketplace entry is unchanged.

## Open Questions

- Whether versions before 0.5.0 are close enough to be a base; they predate the package in the workflows. This does not change the specs: `--from` covers it.
