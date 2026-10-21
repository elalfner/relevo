# Design

## Context

Relevo is distributed as a marketplace whose single entry has `source: "./"`, so the repository root is the plugin. The plugin cache receives everything, and the workflow templates clone the repository twice: a `checkout` for the scripts and `plugin_marketplaces` for the model action.

Checked on Claude Code 2.1.305 with a local npm registry (verdaccio) and a marketplace whose entry is `{ "source": "npm", "package": "@elalfner/relevo-lean" }`: the package was built from this repository with a `files` list, `npm publish` gave a 170 kB tarball (137 files) against a 5.2 MB repository, and `claude plugin install --scope project` put the plugin folders in the cache (about 1 MB with the README and `package.json` that npm always adds), with no `docs/`, `tests/` or `openspec/`. A relative `./plugin` source also worked in a second trial, but needs every path to move.

The Claude Code reference also lists `git-subdir`, `archive` and `command` plugin sources and a `--sparse` option when adding a marketplace.

## Goals / Non-Goals

**Goals:**
- An installation, a project install and a runner hold only what runs.
- One command installs it, at machine or project scope.
- The runner cannot silently run with a partial plugin.
- No command changes behaviour and no path moves.

**Non-Goals:**
- A separate marketplace repository.
- Supporting forks of the workflows.

## Decisions

- **npm package with a `files` whitelist, and the `npm` plugin source.** It gives the lean install and the command in one mechanism, and nothing moves. Alternatives: moving everything to `plugin/` with a relative source (about 70 test files and many docs change, and the CLI still needs the package); `git-subdir` (needs the same move); an `archive` zip per release (the marketplace file would point to a release that does not exist when it is written); `export-ignore` (affects only `git archive`).
- **Package name.** `@elalfner/relevo`, with the bin `relevo`, until the maintainer confirms the scope; the unscoped name may be taken. It is set in one place and checked by a test against the marketplace entry.
- **The CLI is a thin wrapper over `claude plugin`.** `relevo install` runs `claude plugin marketplace add elalfner/relevo --sparse .claude-plugin` and `claude plugin install relevo@relevo --scope <scope>`; `update` runs the two update commands; `doctor` runs `scripts/doctor.mjs`. It takes the scope from `--scope` and defaults to `user`. It writes nothing itself.
- **The runner installs the package.** `npm install --prefix .relevo-plugin --ignore-scripts @elalfner/relevo@<version>`, and the scripts run from `.relevo-plugin/node_modules/@elalfner/relevo/scripts`. The version is pinned in the workflow itself (`env.RELEVO_VERSION`), not in `relevo.yml`: it is where the run reads it, a test keeps the templates in step with the package version, and `init` already reports a workflow that differs from its template. A project controls when it moves by editing one line; `doctor` warns when the pin differs from the installed plugin.
- **Guard step.** A short shell test of the paths a job uses, in `decide` and `build`, failing with the missing path before anything is claimed.
- **Release.** A workflow on tags `v*` checks tag against `package.json`, runs the tests, runs `npm publish --provenance --access public` with the secret `NPM_TOKEN` that the maintainer creates. Order: tag a commit of `dev`, publish, then promote to `main`; the steps are in `RELEASING.md`. The marketplace entry has no `version`, so users get the latest published; the runner pins its own.
- **Development stays the same.** `plugin.json` stays at the repository root, so `claude --plugin-dir .` and `claude plugin validate .` keep working. The `files` list is the only thing that decides what ships, and a test compares `npm pack --dry-run --json` with the list and with the paths that skills and scripts read.

## Risks / Trade-offs

- A package on a public registry makes the plugin public in a new place. It is MIT licensed and already public on GitHub.
- A second channel to keep in sync. Mitigation: one version source (`package.json`), a test that `plugin.json`, the changelog and the package agree, and a release workflow.
- npm unavailable or name taken at release time: the release stops before promoting; the marketplace on `main` still names the previous version.
- The catalogue clone may still be the full repository when the marketplace is added without `--sparse` (for example, by the model action). The plugin that runs is the lean one; the catalogue is not what runs. Accepted.
- `--sparse .claude-plugin` was checked against GitHub with Claude Code 2.1.305: the catalogue on disk was 400 KB with no documentation, tests or OpenSpec folders, and adding it twice is harmless.
- Unverified: that `claude-code-action` installs from an `npm` plugin entry in a real run (the action clones the repository given in `plugin_marketplaces` for the catalogue; the plugin it runs is the package). It is a task to check after the first publish. If it does not work, the fallback is `--plugin-dir` on the unpacked package, outside the workspace.
