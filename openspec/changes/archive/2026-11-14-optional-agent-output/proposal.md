## Why

To find out why a build took 39 minutes, the pilot team edited `relevo-go.yml` and set `show_full_output` for two issue numbers, in two temporary pull requests, against the template's own warning that the input prints tool results (possibly secrets) to the log. The run that was cancelled at 60 minutes had no agent output at all, so nothing could be learned from it. Diagnosing a long run needs the output, and it should not need a hand edit of a protected file. This is finding #129 of the tracking issue #115.

## What Changes

- **A documented switch for the full agent output**, off by default, at two levels: `run.full_output` in `relevo.yml` for a repository, and a `full_output` input of the manual start of `go` for one run. Either one turns it on; neither can turn on a setting that `trust: public` refuses.
- **The template still never sets `show_full_output`.** The action prints tool results as they happen and has no hook to redact them. Instead, a step after the agent reads the runner's execution log and prints a redacted rendering of it in a log group. The output therefore appears when the agent step ends, not while it runs.
- **A redactor with no model**, used by that step and by the transcript below: known secret shapes (provider keys, tokens, private key blocks, credentials in URLs, `KEY=value` lines of environment and credential files) and the exact values of the secrets the job holds.
- **A trimmed transcript is saved when a run ends abnormally** (cancelled, timed out, or ended without an outcome): the last commands of the agent, redacted, as a workflow artifact that the "ended without an outcome" comment links. With the full output on, the short results of those commands are added. With it off, results are never kept.
- **`trust: public` refuses the option and keeps no transcript.** Validation fails when `run.full_output` is set with it; the dispatch input is ignored with a notice; no artifact is uploaded, because the artifacts of a public repository are readable by anyone.
- **The redactor is tested with secrets shaped like the restricted-file list**: an environment file, a private key, `.npmrc`, `.git-credentials`, `.pgpass`, `key.properties`, `google-services.json`.

Out of scope: storing transcripts for longer than the artifact retention, a live (streamed) redacted log, redacting the output of the local and Antigravity modes, and any change to the restricted files or the protected paths. The redactor is a second line of defence, not a control: the closed tool list and the restricted-file denials stay the controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: the workflow prints a redacted rendering of the agent log when the output is on, and saves a redacted trimmed transcript as an artifact when a run ends abnormally, linking it from the comment.
- `security`: redaction of secrets in anything the workflow prints or saves from the agent's log; the option is refused and no transcript is kept for `trust: public`; the redactor is not a control.
- `configuration`: the new setting `run.full_output`, its default, and its validation with `trust`.
- `documentation`: the option, its risk and its limits are described in the security, configuration and execution pages, in English and Spanish.

## Impact

- `templates/workflows/relevo-go.yml`: a `full_output` dispatch input; a step (always) that renders the log and a step that uploads the transcript; the warning comment next to the agent step now points at the option; the "ended without an outcome" comment links the artifact.
- Scripts: a redactor in `scripts/lib`, a reader that turns the execution log into a redacted transcript, and a small decision script that applies the config, the dispatch input and `trust`.
- `scripts/lib/config.mjs` (the setting and its rule with `trust`), `scripts/validate-config.mjs`, `docs/security.md`, `docs/configuration.md`, `docs/execution.md`, `docs/action-parameters.md`, their Spanish pages, `CHANGELOG.md` and the version in `.claude-plugin/plugin.json` and the workflow template.
- `tests/security.test.mjs` keeps requiring that `show_full_output` is never set in the template; new tests for the redactor, the transcript and the decision.
- No change to the labels, the limits or the restricted-file list.
