## 1. Exceptions module

- [x] 1.1 Add `scripts/lib/scan-exceptions.mjs`: parse and validate the JSON, refuse broad or reasonless entries, apply to a diff by path and line text, return findings, applied and refused
- [x] 1.2 Export from `scan.mjs` what the module needs to see the added line of each finding without changing `scanDiff`
- [x] 1.3 Tests in `tests/scan-exceptions.test.mjs`: match, moved line, unlisted line, broad entries, no reason, malformed file, marker never excepted

## 2. Commit and gate

- [x] 2.1 `commit-change.mjs` (lib): read the committed list from HEAD, apply it, return `exceptions` and `refusedExceptions`
- [x] 2.2 `commit-change.mjs` (CLI): print the applied and refused exceptions on stderr, keep the hash on stdout
- [x] 2.3 `validation-gate.mjs`: read the list from the base ref, apply it, put the exceptions in the scan detail
- [x] 2.4 Tests in `tests/commit-change.test.mjs` and the gate test: listed line commits, unlisted refuses, uncommitted list ignored

## 3. Docs and changelog

- [x] 3.1 `docs/security.md` and `docs/security.es.md`: the exception file, its rules and its protection
- [x] 3.2 `skills/go/SKILL.md`: the run comment mentions the applied exceptions
- [x] 3.3 CHANGELOG `[Unreleased]` entry (no version bump)
- [x] 3.4 Run `npm test`
