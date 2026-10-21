# Releasing

For the maintainer. A release publishes the npm package `@elalfner/relevo` and then promotes `dev` to `main`.

## One-time setup

1. An npm account with two-factor authentication, and the `@elalfner` scope (your user or an organization with that name). `npm whoami` must print it.
2. An npm automation token that may publish `@elalfner/relevo`, stored as the repository secret `NPM_TOKEN` (Settings > Secrets and variables > Actions). Create it yourself; no tool or session of Relevo handles its value.
3. A repository that is public, so the package can be published with provenance (`--provenance`).

## Each release

1. On `dev`: bump `version` in `package.json` and in `.claude-plugin/plugin.json`, set the same version in `RELEVO_VERSION` of the five templates in `templates/workflows/`, and move the `[Unreleased]` entries of `CHANGELOG.md` under the new version. `npm test` checks that they agree.
2. Push `dev` and wait for the CI to pass.
3. Tag the commit that will be promoted and push the tag: `git tag -a vX.Y.Z -m "Relevo X.Y.Z" && git push origin vX.Y.Z`. The `release` workflow checks that the tag is the version, runs the tests and publishes the package.
4. When the workflow is green, check the package: `npm view @elalfner/relevo version`.
5. Open the pull request from `dev` to `main` and merge it with a merge commit once the CI passes. Publishing comes first so the marketplace on `main` never names a package version that does not exist.
6. Create the GitHub Release for the tag with the notes of the changelog.

## When something goes wrong

- The workflow stops on a tag that does not match the version: delete the tag (`git push origin :refs/tags/vX.Y.Z`), fix `package.json` and tag again.
- A published version cannot be replaced. Fix forward with the next patch version.
