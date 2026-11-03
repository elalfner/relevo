# Proposal

## Why

The `assigned-secret` pattern of `scripts/lib/scan.mjs` flags any `api_key`, `secret`, `token`, `password` or `passwd` followed by `:` or `=` and 16 or more identifier characters, whether or not the value is quoted. Ordinary code matches: `token: someLongVariableName`, `password = readPasswordFromVault(...)`, `secret = config.clientSecretValue`. The safe commit of `go` refuses the diff, the work is not pushed, and the issue ends in `qa-failed` with no branch (issue #67): the build is lost for something that is not a credential.

## What Changes

- The `assigned-secret` match is decided by its value, not only by its name:
  - a **quoted** value of 16 or more characters is still always flagged;
  - an **unquoted** value is flagged only when it looks like a literal secret: it mixes letters and digits, or contains `/`, `+` or `=` (base64-like), and it is not followed by `(`, `.` or `[` (a call or a member access).
- The provider patterns (`anthropic-key`, `github-token`, `aws-access-key`, `slack-token`, `private-key`, ...) and the `strict` opaque-token check do not change.
- Only added lines are scanned, as now. The finding still names the file, the line and the kind, never the value.
- Tests for both directions, and the requirement written in the `go` specification.

Out of scope: an allowlist per file, an inline exception marker, and reviewing issue #67 again.

## Capabilities

### New Capabilities

### Modified Capabilities
- `go`: what counts as a possible credential in the staged diff, so that code that merely names a secret is not refused.

## Impact

- `scripts/lib/scan.mjs` (the pattern and a small check of the value).
- `findCredentials` is also used by `issue-check.mjs` (the body of an issue) and `config.mjs` (values of `relevo.yml`, in `strict` mode), so they get the same narrower `assigned-secret` match.
- `tests/scan.test.mjs`, and the tests of `commit-change`, `issue-check` and `config` that rely on the pattern.
- `docs/security.md` if it describes what is scanned.
