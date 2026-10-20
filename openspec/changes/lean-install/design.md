# Design

## Context

Relevo is distributed as a marketplace whose single entry has `source: "./"`, so the repository root is the plugin. Claude Code copies the plugin source into its cache, and the workflow templates clone the whole repository twice: a `checkout` for the scripts and `plugin_marketplaces` for the model action.

Observed on Claude Code 2.1.305, with a throwaway marketplace whose entry was `source: "./plugin"` next to `docs/` and `tests/` folders: after `claude plugin install ... --scope project`, the cache held only the contents of `plugin/`. A marketplace added from a local directory is read in place; one added from GitHub is cloned as a catalogue, which still holds the whole repository, but it is not what runs.

## Goals / Non-Goals

**Goals:**
- What runs lives in one folder; the cache, a project install and a runner hold only that.
- The runner cannot silently run with a partial plugin.
- Existing documentation keeps working; no behaviour of any command changes.

**Non-Goals:**
- An npm package or an install CLI.
- A separate marketplace repository.
- Changing what the commands do.

## Decisions

- **One folder, `plugin/`, chosen by the marketplace entry.** Alternatives: `git-subdir` pointing to a subfolder of another repository (needs the same move); an `archive` zip built per release (the marketplace file would have to point to a release that does not exist yet when it is written); `.gitattributes export-ignore` (affects only `git archive`, not what Claude Code clones). The folder move is the one that needs no new infrastructure, and it is checkable by test.
- **Manifest inside the folder.** `plugin/.claude-plugin/plugin.json` is the manifest; `.claude-plugin/marketplace.json` stays at the root with `source: "./plugin"`. The release version check (`plugin.json` against the changelog) reads the new path.
- **Sparse checkout in the templates.** `actions/checkout` with `sparse-checkout: plugin` and `sparse-checkout-cone-mode: true`, then the scripts are read from `.relevo-plugin/plugin/scripts`. The model action keeps `plugin_marketplaces`; the plugin it installs is the lean one.
- **A guard step before the first plugin script.** A short shell test of the three or four paths a job uses, failing with the missing path. It runs in `decide` and in `build`, so a partial fetch cannot claim an issue.
- **Tests keep root `tests/`.** They import from `../plugin/...`. A test that lists the plugin folder and the paths that skills and scripts read keeps a file from being used at run time that an installation would not have.
- **Release.** Moving paths is a breaking change for forks that copied the workflows; it ships with an upgrade note and `doctor` detects it.

## Risks / Trade-offs

- A large mechanical move touching about 70 test files and many docs. Mitigation: `git mv`, a scripted rewrite of import paths, and the full test suite and `openspec validate --all` as the check; no behaviour changes in the same commit.
- A fork or project with the old workflows breaks on the next release. Mitigation: `doctor` reports it, `init` plans the change, the changelog says how to upgrade.
- A sparse checkout misses a file a script reads from the repository root. Mitigation: the requirement and test that nothing outside `plugin/` is read at run time.
- The catalogue clone of the marketplace still holds the whole repository. Accepted; solving it needs a second repository, left as a separate decision.
- Unverified: that `claude-code-action` installs the plugin the same way with `source: "./plugin"`. It is a task to check on a real run in the sandbox before the release.
