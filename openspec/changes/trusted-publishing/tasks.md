# Tasks

## 1. The workflow

- [x] 1.1 `.github/workflows/release.yml`: Node 24, no `NODE_AUTH_TOKEN`, no guard on the secret, a step that prints the Node and npm versions before the publish; keep `id-token: write`, the tag check, the tests and `--provenance --access public`
- [x] 1.2 Update the test of the release workflow: no reference to a publish token, the identity permission, the version line, the order (tag check, tests, publish)

## 2. Documentation

- [x] 2.1 `RELEASING.md`: the one-time setup on npmjs.com (Trusted Publisher, GitHub Actions, `elalfner/relevo`, `release.yml`, no environment), deleting the secret and revoking the token, what a mismatch looks like, and how to re-run
- [x] 2.2 Changelog under Unreleased

## 3. Check

- [ ] 3.1 After the setting is made on npmjs.com and the secret deleted, publish the next release with it and see the provenance and no token in the log
