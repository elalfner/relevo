# Proposal

## Why

Anyone who installs Relevo, on a machine or in a project, and every GitHub Actions run that builds an issue, downloads the whole Relevo repository: documentation, tests, the OpenSpec history, the changelog and brand material. None of it is needed to run the plugin, and it grows with every release. Only the scripts, skills, agents, stack profiles and templates are essential. The installation should also be one command, as other tools of this kind offer (`npm install -g`), with a choice between the machine and one project.

## What Changes

- Publish Relevo as an npm package whose `files` list holds only what runs: the plugin manifest, `scripts/`, `skills/`, `agents/`, `stacks/`, `templates/`, `LICENSE` and `NOTICE`. The repository keeps its layout; nothing moves.
- The marketplace entry uses the `npm` plugin source, so `claude plugin install` fetches the package, not the repository. This was checked end to end with a local registry on Claude Code 2.1.305: the repository is 5.2 MB, the package tarball 170 kB, and the plugin cache of a project-scope install held the plugin folders and no documentation, tests or OpenSpec history.
- A command line, `relevo`, installed with `npm install -g @elalfner/relevo` or run with `npx`: `relevo install [--scope user|project|local]` adds the marketplace (sparse, only `.claude-plugin/`) and installs the plugin; `relevo update`, `relevo doctor` and `relevo version` complete it.
- The workflow templates install the plugin scripts from the pinned package version instead of cloning the repository, and the model action installs the plugin from the same marketplace entry. A guard step stops the run, naming the path, if the package lacks a script the job needs.
- A release workflow publishes the package when a `vX.Y.Z` tag is pushed, with the npm token held as a secret that the maintainer creates.
- `doctor` checks the installation and that the workflows pin a version that exists.
- Update the install, security and configuration pages in English and Spanish, and the tests that read files by path.
- Out of scope: a separate minimal marketplace repository. The catalogue clone of the marketplace still holds the whole repository when added from GitHub, except when the `--sparse` option used by `relevo install` is available.

## Capabilities

### New Capabilities
- `plugin-distribution`: what an installation of Relevo contains, how it is installed, and what a workflow runner downloads.

### Modified Capabilities

## Impact

- `package.json` becomes a publishable package (name, `bin`, `files`, `publishConfig`); it is no longer `private`.
- New `scripts/cli.mjs` and its tests; a release workflow; the two workflow templates; the marketplace entry; `doctor`.
- No existing path moves and no command changes behaviour. There are no forks to keep working.
- The first release needs the package name on npm and a token, both created by the maintainer; Relevo never handles the token.
- A release now has an order: publish the package, then promote `dev` to `main`, so the marketplace on `main` never points to a version that does not exist.
