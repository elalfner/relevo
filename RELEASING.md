# Releasing

For the maintainer. A release publishes the npm package `@elalfner/relevo` and then promotes `dev` to `main`.

## One-time setup

1. An npm account with two-factor authentication, and the `@elalfner` scope (your user or an organization with that name). `npm whoami` must print it.
2. A Trusted Publisher for the package. The release workflow publishes with the identity of its own run and holds no token, so npm has to trust it. On npmjs.com, open `@elalfner/relevo`, then Settings, then Trusted Publisher, choose GitHub Actions and fill in: organization or user `elalfner`, repository `relevo`, workflow filename `release.yml`, and leave the environment empty. Under Allowed actions tick Allow `npm publish`, because the workflow publishes directly (leave Allow `npm dist-tag` unticked). The form says that these fields cannot be changed later: to correct one, delete the connection and create it again. Relevo cannot do this for you and never holds a credential.
3. A repository that is public, so the package can be published with provenance (`--provenance`).
4. Once the Trusted Publisher is saved, delete the repository secret `NPM_TOKEN` (Settings > Secrets and variables > Actions) and revoke the token on npmjs.com (your account, Access Tokens). The workflow does not read it any more, and a token that is not stored anywhere is a token nobody can leak.
5. After the first release that publishes this way has worked, open the package's Settings, then Publishing access, and choose "Require two-factor authentication and disallow tokens". npm recommends it, and a trusted publisher is not affected because it uses the identity of the run and not a token.

## Each release

1. On `dev`: bump `version` in `package.json` and in `.claude-plugin/plugin.json`, set the same version in `RELEVO_VERSION` and in the first line `# relevo-template:` of the six templates in `templates/workflows/`, and move the `[Unreleased]` entries of `CHANGELOG.md` under the new version. `npm test` checks that they agree.
2. Push `dev` and wait for the CI to pass.
3. Tag the commit that will be promoted and push the tag: `git tag -a vX.Y.Z -m "Relevo X.Y.Z" && git push origin vX.Y.Z`. The `release` workflow checks that the tag is the version, runs the tests, prints the versions of Node and npm and publishes the package with the identity of the run.
4. When the workflow is green, check the package: `npm view @elalfner/relevo version`.
5. Open the pull request from `dev` to `main` and merge it with a merge commit once the CI passes. Publishing comes first so the templates on `main` never pin a package version that does not exist: a project that copies a workflow from `main` would pin a version the registry lacks.
6. Create the GitHub Release for the tag with the notes of the changelog.

## When something goes wrong

- The workflow stops on a tag that does not match the version: delete the tag (`git push origin :refs/tags/vX.Y.Z`), fix `package.json` and tag again.
- The Publish step fails and nothing was published: npm did not trust the run. Read the versions printed by the step before it (npm has to be recent enough for Trusted Publishing; the workflow uses Node 24) and then the message of npm, which typically is a 404 on the package or says that the publisher was not accepted. The usual cause is that the Trusted Publisher on npmjs.com does not match: the user `elalfner`, the repository `relevo`, the workflow file `release.yml` and no environment. Fix the setting there.
- After fixing the setting, re-run the workflow from the Actions tab (open the failed run and choose Re-run failed jobs). Do not tag again: nothing was published, and the tag already points at the commit to release.
- Do not rename `release.yml`. The Trusted Publisher is bound to that file name, and a renamed file is a workflow npm does not trust.
- A published version cannot be replaced. Fix forward with the next patch version.
