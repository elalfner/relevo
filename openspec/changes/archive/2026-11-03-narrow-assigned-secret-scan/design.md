## Context

`CREDENTIAL_PATTERNS` in `scripts/lib/scan.mjs` holds one regular expression for `assigned-secret`: a name, `:` or `=`, an optional quote and 16 or more of `[A-Za-z0-9_\-/+=]`. `findCredentials` runs every pattern on a text; `scanDiff` runs it on each added line. The same function guards three places: the safe commit (`commit-change.mjs`, `validation-gate.mjs`, `scan-diff.mjs`), the body of an issue (`issue-check.mjs`) and the values of `relevo.yml` (`config.mjs`, with `strict`). The regex stops at `(` or `.`, so `password = readPasswordFromVault(...)` matches on the identifier before the parenthesis.

## Goals / Non-Goals

**Goals:** stop refusing code that only names a secret; keep refusing literals.
**Non-Goals:** an allowlist per file, an inline marker, a new pattern for other secrets.

## Decisions

- **Keep one pattern, add a second look at the value.** The regex captures the optional quote and the value, and `findCredentials` accepts the match only when the value passes `looksLikeLiteralSecret`. The provider patterns keep their plain match.
- **Quoted values stay flagged.** A string literal of 16 or more characters after a secret name is the case the pattern exists for.
- **Unquoted values are judged by shape.** Flagged when the value mixes letters and digits, or contains `/`, `+` or `=`, and the character after it is not `(`, `.` or `[`. A run of letters, `_` and `-` only (`someLongVariableName`, `read_password_from_vault`) is an identifier.
- **The next character is read from the text,** not from the capture, because the character class does not include `(` or `.`.
- **Same function everywhere.** Issue bodies and `relevo.yml` get the narrower match too; a YAML value that is a long literal is still caught by the mix rule, and `strict` keeps the opaque-token check.

## Risks / Trade-offs

- An unquoted secret made only of letters (`password=abcdefghijklmnopqrstuvwxyz`) is no longer flagged by this pattern. Real keys come from generators and almost always mix digits, and the provider patterns still catch the known formats.
- An identifier with a digit (`token_v2_refresh_handler`) is still flagged. It is rarer than the cases fixed; if it shows up, an exception marker is the next change.
- The scan of the staged diff is still the last line of defence before a push, so each loosening is a trade-off the tests pin down.

## Assumptions

- The false positive of issue #67 was an unquoted identifier or a call, as the regex allows. The exact line was not available when this was planned, so the scenarios use the shapes the regex accepts.
- Nothing outside `scan.mjs` depends on the exact regex; callers use only the kind name.
