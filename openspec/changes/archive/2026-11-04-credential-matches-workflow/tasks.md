# Tasks

## 1. One definition of the active credential line

- [x] 1.1 Move the detection of the active credential line (`anthropic_api_key` vs `claude_code_oauth_token`, ignoring commented lines) from `scripts/lib/doctor.mjs` to a helper that `init` and `doctor` both import, and make `credentialLine` in `scripts/lib/init.mjs` switch either way and throw only when neither line exists. Verify with `tests/init.test.mjs`: api to subscription, subscription to api, already in the mode, a text with neither line (throws), on the real template.

## 2. `doctor` compares the secret with the line

- [x] 2.1 In `executionChecks` add the result `execution.credential-line`: a warning when exactly one secret exists and the active line is the other mode, with the line to change in its fix; nothing when both exist, when none exist, when the line is unknown, or when they agree. Verify with new tests in `tests/doctor.test.mjs`, one per scenario of the `init-doctor` spec, and run the existing both-secrets test unchanged.
- [x] 2.2 `automation.secret` keeps its text for the existing cases and does not pass silently on a mismatch (the mismatch has its own result). Verify with the existing `automation.secret` tests plus one with the mismatch.
- [x] 2.3 Document the check in `docs/execution.md` and `docs/execution.es.md`, same headings in both. Verify with `node --test tests/docs-claims.test.mjs`.

## 3. `init` takes and flags the credential

- [x] 3.1 Resolve the credential in force in the order of design decision 1 (explicit answer, only secret, installed line, `api_key`) in one function, and use it for `wanted`, for `limits.concurrent_agents` and for the plan items; say in the plan when `api_key` was assumed. Verify with `tests/init.test.mjs`: every step of the order, both secrets, no secrets, an installed subscription line, the reported case (installed API line, only token, no answer).
- [x] 3.2 `manual.api-key`: a manual item that names both secrets when an explicit answer contradicts the only secret that exists; `ok` when they agree. Verify with `tests/init.test.mjs` for both directions.
- [x] 3.3 Put the literal `pbpaste | tr -d '[:space:]' | gh secret set CLAUDE_CODE_OAUTH_TOKEN` in one constant used by the `subscription` plan item, and mention the two-line output and the incomplete token. Verify with `tests/init.test.mjs`.

## 4. The merge switches and keeps the line

- [x] 4.1 `planUpgrades` takes the credential in force and its `render` applies `credentialLine` to the current template and every base. Verify with a new test in the workflow-upgrade tests: installed API line with `subscription` gives an `update` that shows the diff; a subscription file with no answer gives `current`; a subscription file with an explicit `api_key` answer gives an `update` back.
- [x] 4.2 Run the merge for every template under `tests/fixtures/workflows/` (including `relevo-go-0.12.0.yml`) in both modes and verify that the chosen base does not change between modes and that no conflict appears in the credential lines.
- [x] 4.3 Wire the credential in force from `scripts/init.mjs` to `planUpgrades`. Verify with a plan test that has the same wiring as `scripts/init.mjs` (the command itself needs `gh` and the network) over an installed API-line workflow and only the token secret.

## 5. The guide

- [x] 5.1 `docs/get-started.md` and `docs/get-started.es.md`: the literal command and the two-line warning, at the place that now says to store the token "the same way". Verify with a test in `tests/docs-claims.test.mjs` that both files contain the constant of 3.3.
- [x] 5.2 `skills/init/SKILL.md`: the question about the credential says that the answer is taken from the secret when it is left empty, and that a contradiction is shown in the plan. `skills/doctor/SKILL.md` names the new result. Verify with `tests/skill-init.test.mjs` and `tests/skill-doctor.test.mjs` if they exist, else with `tests/docs-claims.test.mjs`.

## 6. Release notes

- [x] 6.1 Add the entry to `CHANGELOG.md` under the next patch version, in the project's format, and leave the version in `.claude-plugin/plugin.json` for the release step. Verify with `node --test` over the whole suite passing.
