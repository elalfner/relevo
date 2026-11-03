## 1. Scanner

- [x] 1.1 `scripts/lib/scan.mjs`: capture the quote and the value of `assigned-secret`, read the character after the value, and accept the match only when the value is quoted, or unquoted and `looksLikeLiteralSecret` (letters and digits, or `/`, `+`, `=`) and not followed by `(`, `.` or `[`
- [x] 1.2 Tests in `tests/scan.test.mjs`: no finding for a variable reference, a call and a member access; a finding for a quoted literal and for an unquoted value with letters and digits; the provider patterns and `strict` unchanged; the value never in a finding

## 2. Callers and documentation

- [x] 2.1 Check the tests of `commit-change`, `issue-check` and `config` that rely on `assigned-secret` and add one case to `commit-change` where code that names a secret is committed
- [x] 2.2 `docs/security.md`: say what the scan treats as an assigned secret, if it describes it
- [x] 2.3 Run the full test suite and `openspec validate narrow-assigned-secret-scan`
