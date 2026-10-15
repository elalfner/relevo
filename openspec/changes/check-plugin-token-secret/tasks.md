## 1. Doctor check

- [ ] 1.1 In `scripts/lib/doctor.mjs`, after `automation.plugin-clone`, add `automation.plugin-secret`: when `f.pluginRepoPrivate === true` and `f.secrets` is an array, emit `pass` if it includes `RELEVO_PLUGIN_TOKEN`, otherwise `fail` with the fix from the spec (read-only token, organization secrets not visible)
- [ ] 1.2 Confirm nothing is emitted when `pluginRepoPrivate` is `false` or `null`, or when `f.secrets` is `null`

## 2. Tests

- [ ] 2.1 In `tests/doctor.test.mjs`, add the four scenarios of the spec (missing, present, public, unknown visibility or unreadable secrets)
- [ ] 2.2 Adjust any existing test that sets `pluginRepoPrivate: true` and compares the full list of failures so its fixture includes the secret
- [ ] 2.3 Run the full test suite and `node scripts/doctor.mjs` against a repository, and check the report and fix text read correctly
