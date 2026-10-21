# Proposal

## Why

The release workflow publishes with an npm token kept as the repository secret `NPM_TOKEN`: a long-lived credential that can publish any package of the `@elalfner` scope, that expires and must be renewed, and that npm itself warns against for automation (its page for tokens says to use Trusted Publishing instead). Now that the package exists, npm can trust the release workflow directly: the workflow proves who it is with a short-lived identity token that GitHub issues for that one run, and no secret has to be stored. The workflow already asks for `id-token: write` and publishes with provenance.

## What Changes

- The `release` workflow no longer reads `NPM_TOKEN`: it publishes with the identity of the run. It uses a Node version whose npm supports Trusted Publishing, and keeps the checks that stop a wrong tag, the tests, and the order of the release.
- The guard that stopped when the secret did not exist goes; a failed login now fails the publish step with npm's own message, which names the likely cause (the trusted publisher on npmjs.com does not match this repository and workflow file).
- `RELEASING.md` replaces the token setup with the one-time setup on npmjs.com (the package's Trusted Publisher: GitHub Actions, repository `elalfner/relevo`, workflow `release.yml`, no environment), and says to delete the secret `NPM_TOKEN` and revoke the token afterwards.
- The test of the release workflow follows; the changelog says it. The first release with it is the next one.
- Out of scope: provenance (already on), publishing from another workflow, and any change to what is published.

## Capabilities

### New Capabilities

### Modified Capabilities
- `plugin-distribution`: a release publishes with the identity of the workflow, not a stored token.

## Impact

- `.github/workflows/release.yml`, `RELEASING.md`, `tests/package.test.mjs`, the changelog. Nothing that runs in a project changes.
- Until the trusted publisher is set on npmjs.com, a tag does not publish; the person sets it before the next release. A failed run can be re-run after the setting is fixed.
