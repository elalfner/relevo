# Proposal

## Why

The Get started page is complete but not easy. A read-through as a newcomer found five problems: step 1 shows two install blocks, so a person may run both; step 3 packs everything `init` does into a long "You should see"; the build installs the toolchain but not the dependencies of a Vue or Laravel project, so a newcomer with those stacks fails QA after a paid run, the same trap that already caught Flutter; several terms (ruleset, OpenSpec root, milestone, secret, QA) are used without a word of explanation; and nobody has followed the page from nothing. The page is the first thing a new person reads and it ships in 0.3.1.

## What Changes

- Step 1 gives one install path: the two `claude plugin` commands, with `--sparse .claude-plugin` and one sentence about the scope. The npm shortcut and the `relevo` command stay in the Install page and the cover.
- Step 3 summarises what `init` asks and what the plan shows in a few lines; the rare cases (no OpenSpec root, no branch protection on a free private repository, no repository found) move to the table of problems at the end.
- Step 6 and the table say that the build installs the toolchain but not the dependencies of the project: Flutter needs nothing more; for Vue and Laravel the project enables `npm ci --ignore-scripts` or `composer install --no-scripts` in `relevo-go.yml`, or QA fails.
- The first time each of ruleset, OpenSpec root, milestone, secret and QA appears, one plain sentence says what it is.
- Both languages, the same steps and the same format ("You should see", "If not").
- Tests follow: the page has exactly one install block for the plugin, mentions the dependencies of Vue and Laravel, and the test that asked every page to show the npm command no longer asks it of Get started.
- Out of scope: a walk-through by a person on a clean repository (done after this change and fed back as corrections), and any code.

## Capabilities

### New Capabilities

### Modified Capabilities
- `documentation`: the Get started requirement gains one install path, plain-language terms and the note about dependencies.

## Impact

- `docs/get-started.md`, `docs/get-started.es.md`, the tests `docs-claims`, `readme-sync` and `cli` that name the page, the changelog.
- No code and no behaviour change.
