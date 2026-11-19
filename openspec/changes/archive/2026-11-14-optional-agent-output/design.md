# Design

## Context

The cloud workflow runs the agent with `anthropics/claude-code-action@v1`. The action's `show_full_output` prints tool results to the log as they happen, with no redaction, which is why the template forbids it and `tests/security.test.mjs` checks that it is never set. The action does expose `execution_file`, a list of events (`system`, `assistant` with `tool_use`, `user` with `tool_result`, `result`), which `run-usage.mjs` and `usage-limit.mjs` already read tolerantly after the agent step with `if: always()`. The `no_outcome` step already comments on a run that ended without an outcome. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Diagnose a long, cancelled or timed-out run without editing a protected file.
- Print and save nothing from the agent that has not passed the redactor.
- Keep every existing guard: the template stays free of `show_full_output`.

**Non-Goals:**
- Live output while the agent runs.
- Long-term storage; the artifact uses the repository's default retention.
- Local mode and Antigravity (their output is already in the person's terminal or has its own guard).

## Decisions

**D1. Render the log after the step; never use `show_full_output`.** A step with `if: always()` reads `execution_file` and prints a redacted rendering inside a `::group::`. Alternative: pass `show_full_output` and mask patterns with `::add-mask::`. Discarded: masks work on exact values, not shapes, and the unredacted text is already printed when the mask would apply. Cost: no output until the agent step ends. A cancelled job still runs `always()` steps, as the existing report steps show, but a runner that is killed outright leaves no log; then there is nothing to render and the comment says so.

**D2. Two switches, one decision script.** `run.full_output` (repository) and a `full_output` boolean input of `workflow_dispatch` (one run). A small script takes the config, the input and `trust` and prints `{ output, transcript, refused }`; the workflow only reads its output. Alternative: an action variable. Discarded: a variable is a third place to look and cannot be refused by validation. A run started by the label never has the input, so only the repository setting applies to it; for one issue, a person uses the manual start.

**D3. Transcript content depends on the switch, not on the abnormal end.** Off: commands only (tool name plus the command or the path, no result). On: also the first 300 characters of each result. Both are the last 200 entries and at most 200 KB. A result is the usual place for a secret (a `cat` of a file), a command is much rarer, so commands alone are a safe default that still explains a stop.

**D4. Artifact, not comment.** A comment on the issue is permanent and visible to everyone who can read the issue, and deleting it later does not remove it from notifications or caches. A workflow artifact expires and needs a login to read. The `no_outcome` comment gets one line with the run URL, where the artifact is listed, instead of the text. Alternative: a link to the artifact URL itself. Discarded: the artifact id is only known to the upload step; the run page lists it with no extra plumbing. The step uploads with `actions/upload-artifact` pinned to a version, needs no extra token permission, and sets a short retention (7 days).

**D5. The redactor works on shapes and on values.** Shapes: `sk-ant-`, `ghp_`/`ghs_`/`github_pat_`, `AKIA`/`ASIA` keys, `AIza` Google keys, JWTs, `-----BEGIN ... PRIVATE KEY-----` blocks through their end line, `scheme://user:password@host`, `Authorization: Bearer ...`, `_authToken=`, and `NAME=value` where NAME contains KEY, TOKEN, SECRET, PASSWORD, PASSWD or CREDENTIAL. Values: each of the secrets the job passes in an environment variable (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, the workflow token), replaced wherever they appear, including in a different encoding (base64) when 8 or more characters long. Everything is replaced by `[redacted]`. Alternative: a general entropy detector. Discarded: it redacts hashes and ids and hides what a diagnosis needs. Anything the reader cannot parse as a known entry is dropped, never printed raw.

**D6. `trust: public` means no output and no artifact.** Validation rejects `run.full_output` with it. The transcript steps do not run, because the artifacts of a public repository are readable by anyone. The workflow decides it from the same script, so a stale copy of the template cannot print what the config refuses.

**D7. The steps cannot change the outcome.** They are `continue-on-error: true`, read-only on labels and issues, and sit before the progress report closes.

## Risks / Trade-offs

- [A secret in a shape the redactor does not know reaches the log or artifact] → off by default, commands only for the transcript, documented as a risk, tested with the restricted-file shapes; the controls that keep secrets from the agent stay.
- [A runner killed outright leaves no execution log] → say so in the comment instead of promising a transcript; the progress report and the usage record are unchanged.
- [The rendering arrives late] → accepted; live output is the thing that cannot be redacted.
- [The log format is not documented] → the reader is tolerant like `run-usage.mjs`; an unreadable log gives a notice, never a failure.
- [Artifacts are not tied to the issue] → the comment carries the run URL, and the retention is 7 days.

## Migration Plan

A repository gets the feature by taking the new `relevo-go.yml` (`/relevo:init` reports an older copy). Without it nothing changes. Rollback: set `run.full_output: false` or take the older template.
