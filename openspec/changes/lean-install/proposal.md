# Proposal

## Why

Anyone who installs Relevo, on a machine or in a project, and every GitHub Actions run that builds an issue, downloads the whole Relevo repository: documentation, tests, the OpenSpec history, the changelog and brand material. None of it is needed to run the plugin, and it grows with every release. Only the scripts, skills, agents, stack profiles and templates are essential. The Actions runner must also keep finding the plugin without any step that can silently fetch less than it needs.

## What Changes

- Move the part of the repository that runs (`scripts/`, `skills/`, `agents/`, `stacks/`, `templates/` and the plugin manifest) under one folder, `plugin/`. Documentation, tests, `openspec/`, the changelog, `docs/brand/` and the trademark pages stay at the repository root and are never part of an installation.
- The marketplace entry points to `./plugin`, so `claude plugin install relevo@relevo` (user, project or local scope) copies only that folder into the plugin cache. This was checked with a throwaway marketplace on Claude Code 2.1.305: only the plugin folder reached the cache.
- The workflow templates fetch the plugin scripts with a sparse checkout of `plugin/` only, and the model action installs the plugin from the same marketplace entry.
- `doctor` checks that an installed plugin has the folders it needs and `init` writes templates that point to the new layout; existing projects that already have the workflows keep working until they run `/relevo:init` again, which lists the difference.
- Update the install, security and configuration pages (English and Spanish) and the tests that read files by path.
- Out of scope, decided separately: an npm package with an install command (`npm install -g`), because it adds a second distribution channel to keep in sync; and a second, minimal marketplace repository so that even the marketplace catalogue is small.

## Capabilities

### New Capabilities
- `plugin-distribution`: what an installation of Relevo contains and what a workflow runner fetches, and the guarantee that the runner finds the plugin.

### Modified Capabilities

## Impact

- Every path to `scripts/`, `skills/`, `agents/`, `stacks/` and `templates/` moves under `plugin/`: the manifest, `package.json` scripts, about 70 test files, the workflow templates (`.relevo-plugin/scripts/...`), the docs that name those paths and `skills-lock.json` if it records them.
- `${CLAUDE_PLUGIN_ROOT}` inside skills is unchanged: it points at the installed plugin folder, now the `plugin/` content.
- A project that installed 0.2.0 keeps working: the marketplace entry changes, and `claude plugin marketplace update` plus a reinstall picks the new layout.
- A release changes the tag layout; it belongs in 0.2.1 or 0.3.0, decided when it ships.
