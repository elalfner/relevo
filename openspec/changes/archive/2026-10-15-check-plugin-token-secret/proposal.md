## Why

In a repository whose plugin repository (`elalfner/relevo`) is private, the `review`, `queue`, `digest` and `sla` workflows fail at their second `actions/checkout` when the secret `RELEVO_PLUGIN_TOKEN` is missing: the `token: ${{ secrets.RELEVO_PLUGIN_TOKEN || github.token }}` line falls back to the default token, which cannot read another private repository. `ship-check` then sees `review` red and blocks the merge. `doctor` already fails when a workflow has no `token:` at all, but it passes when the workflow is correct and the secret does not exist, which is the state that produced the failure in `relevo-sandbox`.

## What Changes

- `doctor` reports a failure when the plugin repository is private and the repository has no secret named `RELEVO_PLUGIN_TOKEN`. The fix says to store a read-only fine-grained token with that name, and that an organization-level secret is not visible to this check.
- The check stays silent when the plugin repository is public or its visibility cannot be read, and when the secret list itself could not be read (that case already has its own warning).
- The four workflow templates already carry the `token:` line (commit `0292322`); no template changes.
- The "differs" message `init` prints for an installed workflow that no longer matches its template is not changed; `doctor`'s existing `automation.plugin-checkout` fix already tells the user to copy the current templates.

## Capabilities

### New Capabilities

### Modified Capabilities

- `init-doctor`: the check that the plugin repository can be cloned by the runner also covers the credential secret existing, not only the workflows referencing it.

## Impact

- `scripts/lib/doctor.mjs`: one new check after `automation.plugin-clone`.
- `tests/doctor.test.mjs`: scenarios for the new check.
- `skills/doctor/SKILL.md`: no change expected (it delegates to the script).
- No new GitHub permission: the secret names are already listed by `doctor`.
