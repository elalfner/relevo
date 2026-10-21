# Tasks

## 1. The package

- [x] 1.1 Make `package.json` publishable: name `@elalfner/relevo`, `bin`, `files` whitelist, `publishConfig.access: public`, no `private`
- [x] 1.2 Test that `npm pack --dry-run --json` lists only the whitelist, and that no script or skill reads a path outside it
- [x] 1.3 Test that the version in `package.json`, `plugin.json` and the changelog agree, and that the marketplace entry names the package

## 2. The command line

- [x] 2.1 `scripts/cli.mjs` with `install [--scope]`, `update`, `doctor` and `version`; it checks that `claude` and `node` exist and says how to fix a missing one
- [x] 2.2 Test the commands it builds with a fake `claude` on the path, for each scope, and the failure when `claude` is missing

## 3. Marketplace and workflows

- [x] 3.1 Marketplace entry with the `npm` source for the package
- [x] 3.2 Workflow templates install the pinned package for the scripts (`RELEVO_VERSION` in each template, kept equal to the package version by a test), with the guard step in `decide` and `build`
- [x] 3.3 Tests: the templates do not clone the plugin repository for scripts, the guard names the paths each job uses, the pin equals the package version
- [x] 3.4 `doctor` reports an installation without the folders it needs and workflows that clone the repository or have no pin

## 4. Release

- [x] 4.1 Release workflow on `v*` tags: tag against version, tests, `npm publish --provenance`; the token is the secret `NPM_TOKEN`
- [x] 4.2 Document the order (publish, then promote) and the one-time setup the maintainer does (npm scope, token, 2FA)

## 5. Documentation

- [x] 5.1 Update `docs/install.md`, `docs/get-started.md`, `docs/security.md`, `docs/configuration.md` and the Spanish pages: the commands, machine and project scope, what an installation holds, what the runner downloads
- [x] 5.2 Changelog entry; keep English and Spanish parity and the claims tests passing

## 6. Check on real runs

- [x] 6.1 Install from the real registry at project scope in a clean project and list the cache
- [x] 6.2 Run a build in the sandbox with the new templates and confirm the model action finds the plugin
