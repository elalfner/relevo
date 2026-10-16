## Context

`doctor` already collects `f.secrets` (names only, `repos/{repo}/actions/secrets`) and `f.pluginRepoPrivate` (`repos/{slug}` `.private`, `null` when unknown). Two checks cover a private plugin today: `automation.plugin-checkout` (a checkout without `token:`) and `automation.plugin-clone` (the `plugin_marketplaces` URL without a credential). Neither looks at whether the secret the templates reference exists. With the `|| github.token` fallback in the templates, a missing secret fails silently at run time.

## Goals / Non-Goals

**Goals:**
- Fail in `doctor` for the one remaining way a private plugin breaks the workflows: the secret is absent.
- Reuse the data already collected; no new API call or permission.

**Non-Goals:**
- Reading or validating the token value or its scopes.
- Looking up organization-level or environment secrets.
- Changing the templates, `init`, or the `differs` handling of installed workflows.
- Removing the `token:` line if the plugin becomes public; the fallback already makes it harmless.

## Decisions

- **Severity `fail`.** A private plugin without the secret breaks `review` and blocks `ship`, and the sibling checks `automation.plugin-checkout` and `automation.plugin-clone` are already `fail` under the same condition. A `warn` would let the exact configuration that failed in the sandbox through.
- **Condition: `pluginRepoPrivate === true` and `f.secrets` is an array.** `null` for either means "unknown", which the existing code treats as no finding. A separate warning for an unreadable secret list already exists (`automation.secret`).
- **Check id `automation.plugin-secret`, placed after `automation.plugin-clone`.** It follows the naming of its neighbours. It emits `pass` when the secret exists so the report shows the three plugin checks as a set.
- **Organization secrets are a known blind spot.** The repository secrets endpoint does not list them. The fix text names this so a user who stores the token at organization level knows to ignore the failure or move the secret. Querying `orgs/{owner}/actions/secrets` was rejected: it needs organization read access most users lack, and it would add a second source of "unknown".

## Risks / Trade-offs

- [False failure for an organization-level secret] → the fix text says so; the cost is one message, against silently accepting a broken setup.
- [Existing doctor tests that set `pluginRepoPrivate: true` with secrets lacking the token] → they assert specific ids via `byId`, but any that compare the full list of failures must add the secret to their fixture.
