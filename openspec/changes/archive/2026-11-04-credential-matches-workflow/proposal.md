## Why

With a Claude subscription, the first cloud build fails and neither `init` nor `doctor` says so. `relevo-go.yml` keeps passing only `anthropic_api_key` to `claude-code-action` while the only stored secret is `CLAUDE_CODE_OAUTH_TOKEN`, so the action stops with "Either ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN, or workload identity federation ... is required" and the issue ends in `relevo:qa-failed`. Reported on plugin 0.14.2 (Flutter and Supabase): `init` was run with the default `credential: api_key`, the token was stored afterwards, and `doctor` passed because it only checks that one of the two secrets exists.

Reading the code shows the same weak check in three places (the gate of `relevo-go.yml`, `doctor`'s `automation.secret`, and `init`'s `manual.api-key`), and one more gap: re-running `init` with `subscription` on a workflow that is already installed does not switch the line. The three-way merge renders the current template and every published base without `credentialLine`, so the merge sees no change and reports the file as up to date. A warning from `doctor` that says "re-run init" would therefore point at an action that does nothing.

## What Changes

- **`doctor` compares the secret with the workflow.** When exactly one of the two secrets exists and the active credential line of `relevo-go.yml` (the one not commented out) is the other one, `doctor` warns and says which line to change. It works in both directions. A workflow with neither line active is not judged. With both secrets the existing warning stays, and it keeps naming the line in use; no mismatch warning is added on top.
- **`init` reads the secret when the person gave no answer.** With no `credential` answer, `init` deduces the mode from the secret names it already lists (only `CLAUDE_CODE_OAUTH_TOKEN` gives `subscription`, only `ANTHROPIC_API_KEY` gives `api_key`). With both or none it assumes `api_key` and says so in the plan. An explicit answer is respected, and when it contradicts the only secret that exists, the plan says so instead of reporting the credential as fine.
- **`init` can switch the credential line of a workflow that is already installed.** The three-way merge renders the current template and the published bases with the chosen credential, so that a changed answer is a change the merge applies, and a line the person already switched is kept.
- **The merge keeps a subscription workflow** when `init` runs again on a file the person changed to `claude_code_oauth_token`. This works today; the change fixes it with a scenario and a test.
- **The guide gives the storage command literally**: `pbpaste | tr -d '[:space:]' | gh secret set CLAUDE_CODE_OAUTH_TOKEN`, in `get-started` (English and Spanish) and in the plan item of `init`, because `claude setup-token` prints the token over two lines and a token pasted incomplete gives the same authentication error.

Out of scope: authentication by workload identity federation; how the quota of a subscription is shared between runs; changing the `HAS_CREDENTIAL` gate of the workflow so that it checks only the secret the workflow uses (a follow-up, because it touches the `credential` marker block that `build-preflight-gates` also uses).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `init-doctor`: `doctor` warns when the only secret does not match the active credential line; `init` deduces the credential mode from the secret when no answer is given, flags a contradicting answer, switches the credential line of an installed workflow through the merge, and keeps a line the person already switched.
- `execution-modes`: the mode deduced from the secret names must agree with the credential line the workflow uses; a mismatch is a configuration error to report, not a mode.

## Impact

- Code: `scripts/lib/doctor.mjs` (`executionChecks`, `automation.secret`), `scripts/lib/init.mjs` (`credentialLine`, the plan items, the default of `credential`), `scripts/lib/workflow-upgrade.mjs` (`planUpgrades` and the `render` it builds), and the callers that pass the answers.
- Tests: `tests/doctor.test.mjs`, `tests/init.test.mjs`, and a merge test over the historical templates in `tests/fixtures/workflows/`.
- Docs: `docs/get-started.md` and `docs/get-started.es.md`, and the plan text of `init` (English and Spanish).
- Behavior change to watch: `render` is shared by every merge, so the published bases must be rendered with the same credential as the current template, or the choice of the closest base (`chooseBase`) can move.
