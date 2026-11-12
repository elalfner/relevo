# Tasks

## 1. The catalog: fallback, parity test, new kinds

- [x] 1.1 In `scripts/lib/messages.mjs` make `renderMessage` fall back to the English entry when the language lacks a kind. Verify with a test that removes a kind from a copy of the Spanish catalog and sees the English text.
- [x] 1.2 Add `tests/messages-language.test.mjs`: every supported language has every kind of English and no other, the same placeholders per line, no `{{…}}` left after rendering each kind with sample data, and the same for the usage phrase table of 3.1. Verify that it fails when a kind or a placeholder is removed from `es`.
- [x] 1.3 Add the kinds `run_failed_early` and `run_no_outcome` (situations `kept`, `usage_limit`, `no_result`; `cut`, `rescue_state`, `rescue_branch`, `rescue_detail`, `job_status`, `run`, `assignee`, `issue`) to `REQUIRED` and to both catalogs, with the texts that `relevo-go.yml` carries today (commands and labels unchanged). Verify each variant in both languages in `tests/messages.test.mjs`, including the `rescue/*` branch case and the three `rescue_state` notes.

## 2. The queue comment

- [x] 2.1 In `scripts/lib/plan.mjs` count `ahead` (issues queued for an agent slot before this one) and list the active issues; pass `active`, `active_issues`, `ahead` and `typical_minutes`/`typical_samples` to `queued_agents`, and `built_issues` to `queued_capacity`. Verify in `tests/plan.test.mjs`: two running and one ahead, urgent first, an already queued issue counted, no `ahead` for the first.
- [x] 2.2 In `scripts/lib/github.mjs` read the `build` job of the most recent completed runs of `relevo-go.yml`, up to 10 builds among the last 30 runs, into `recent_builds_min` (or `null` on any error); `scripts/go-plan.mjs` passes it to `planGo`. Verify with a fake `gh` in `tests/github.test.mjs`: durations, fewer than three, a 403, a run with no `build` job.
- [x] 2.3 Render the new lines of `queued_agents` and `queued_capacity` in both languages, `unknown`/`desconocido` for an absent figure, and no number when the data is missing. Verify in `tests/messages.test.mjs`.

## 3. The usage comment in the language

- [x] 3.1 Add `USAGE_TEXT` and `usageText(language)` to `messages.mjs`; make `usageLine` in `scripts/lib/run-usage.mjs` take `language` and use it; `scripts/run-usage.mjs` reads `--language` or `language` from `--config`. Verify in `tests/usage.test.mjs` that the English sentence is unchanged byte for byte and that Spanish has no English phrase.

## 4. The workflow templates

- [x] 4.1 Re-verify each pin of design D1 from the action's repository (`git ls-remote --tags`, clone at the tag, `runs.using`, the commit equals the tag) and write down the commands for the PR. Then replace the `uses:` lines of the six workflows and `templates/deploy-supabase.yml` (checkout, setup-node, create-github-app-token, supabase/setup-cli) by the SHA with the version comment, including the commented example of the Vue cache. Verify with a new test in `tests/workflow-package.test.mjs` that lists every `uses:` of the five Node-based actions, requires `@<40 hex> # vX.Y.Z`, and fails on a tag; and update the matching regexes of `workflow-go`, `workflow-ship`, `security` and `doctor` tests.
- [x] 4.2 In the `build` job of `relevo-go.yml` add `BUN_VERSION: '1.4.4'` to `env`, then the steps of design D3 for Bun and for OpenSpec (restore, install on a miss, save at once, version check), all before "Check the toolchain" and the agent, with `continue-on-error` on restore and save; add `path_to_bun_executable` to the agent step. Verify in `tests/workflow-go.test.mjs`: the key contains the version, the OS and the architecture; there is no `cache/save` or combined `cache` step after the agent; `no-cache: true` on setup-bun; the version check exists.
- [x] 4.3 Add `actions: read` to the `decide` job and keep `actions: write` only in `requeue` jobs. Verify in `tests/security.test.mjs`.
- [x] 4.4 Replace the inline comments of `relevo-go.yml` (the `decide` step and the three branches of the `build` job) by calls to `render-message.mjs` with the English fallback described in design D6. Audit every other path that posts a comment (`gh issue comment`, `--body`, scripts that call `gh`) for English text outside the catalog and move or list what is found. Verify in `tests/workflow-go.test.mjs` that the steps call `run_failed_early` and `run_no_outcome`, that each still removes the same labels and keeps `reported=true`, and by running the shell of the step against a stub `gh` for each situation in `en` and `es`.
- [x] 4.4b Add `path_to_bun_executable` to the documented inputs of `tests/security.test.mjs` and `docs/action-parameters.md`.

## 5. Doctor

- [x] 5.1 Add the table of old action pins and the warning `automation.action-pins` to `scripts/lib/doctor.mjs`; it reads files only. Verify in `tests/doctor.test.mjs`: an old workflow warns with file, action and line, current pins pass, a pin of another action is ignored, nothing is written.

## 6. Documentation and check

- [x] 6.1 Update `docs/action-parameters.md`, `docs/execution.md` and `docs/security.md` and their `.es.md` pages (pins by SHA and how to raise them, the Bun and OpenSpec caches and why they are saved before the agent, the queue comment, `actions: read`, the language fallback and the runner version note). Verify with the doc tests (`docs-claims`, `readme-sync`).
- [x] 6.2 Add the entries to the Unreleased section of `CHANGELOG.md` (no version bump, `.claude-plugin/plugin.json` untouched).
- [x] 6.3 Run `openspec validate --all` and `npm test`; open the draft pull request against `dev` with what is not verified and what to test by hand, and the commands used to verify each pin. Do not archive and do not merge.
