# Tasks

## 1. The redactor

- [ ] 1.1 Add `scripts/lib/redact.mjs` with `redact(text, { secrets })`: replace the known shapes and the exact values (plain and base64) of the secrets passed in, with `[redacted]`. Verify with a new `tests/redact.test.mjs` that uses real-looking fixtures for each restricted-file shape (environment file, PEM block, `.npmrc` token, `.git-credentials` URL, `.pgpass` line, `key.properties` password, Google service key), the job's own secret values and a secret with a regex-special character, and asserts that none of the values survives and that ordinary text and ids are unchanged.
- [ ] 1.2 Make the redactor operate on text only. Verify with a test that it never opens a path and that `scripts/lib` has no import of `fs` in `redact.mjs`.

## 2. The transcript reader

- [ ] 2.1 Add `scripts/lib/transcript.mjs` and `scripts/transcript.mjs`: read the execution log tolerantly (array, JSON lines, one object), keep the `tool_use` entries (name plus command or path), optionally the first 300 characters of each `tool_result`, the last 200 entries and at most 200 KB, redact everything, drop an entry it cannot parse, and print the rendering. Verify with `tests/transcript.test.mjs`: commands only, with results, a truncated result, an unparseable entry, an empty log, a missing file, and a secret inside a result that never appears.
- [ ] 2.2 Add `--summary` to say how many entries were kept, for the comment. Verify with the same test file.

## 3. The decision and the setting

- [ ] 3.1 `scripts/lib/config.mjs`: add `run.full_output` (bool, default false) and a rule that refuses it with `trust: public`. Verify with `tests/config.test.mjs`: default, wrong type, public with true, public with false, private-team with true.
- [ ] 3.2 Add `scripts/run-output.mjs`: given the config, the dispatch input and `trust`, print `{ output, transcript, refused }` (`refused` with the reason for a public repository). Verify with `tests/run-output.test.mjs` for the four sources and the public case.

## 4. The workflow

- [ ] 4.1 `templates/workflows/relevo-go.yml`: add the `full_output` boolean input; a step with `if: always()` and `continue-on-error: true` that runs the decision, then prints the rendering in a log group when `output` is true; a step that uploads the transcript with `actions/upload-artifact` (pinned, 7 days) when the run ended abnormally and `transcript` is true. Keep `show_full_output` unset and rewrite the warning comment next to the agent step to point at the option. Verify with `tests/agent-workflow.test.mjs` (the steps exist, run always, never fail the job, no new permission) and `tests/security.test.mjs` (`show_full_output` still absent).
- [ ] 4.2 The `no_outcome` comment links the run page and says whether a transcript exists. Verify with `tests/messages.test.mjs` in both languages and with the workflow test.
- [ ] 4.3 `/relevo:init` and `/relevo:doctor` report an older `relevo-go.yml` that lacks the steps, as they do for other template changes, and `tests/fixtures/workflows` keeps a copy of 0.14.4 for the merge. Verify with `tests/init.test.mjs` and `tests/doctor.test.mjs`.

## 5. Documentation and release

- [ ] 5.1 `docs/security.md`, `docs/configuration.md`, `docs/execution.md`, `docs/action-parameters.md` and the Spanish pages: the option, the two switches, what is printed and saved with it on and off, the delay, the limits of the redactor, `trust: public`, the retention. Verify with `node --test tests/docs-claims.test.mjs`.
- [ ] 5.2 `CHANGELOG.md`, the version of `.claude-plugin/plugin.json` and the `relevo-template` line of `relevo-go.yml`, on `dev` first. Verify with `tests/changelog.test.mjs` and `git branch --show-current` before the commit.
- [ ] 5.3 Run the whole suite with `npm test`. Verify that it passes, and run `openspec validate optional-agent-output`.

## Workflow follow-up

- Close issue #129 with a pointer to the release; write the result in #115.
- Measure on a real long run that the transcript of a cancelled job is saved.
