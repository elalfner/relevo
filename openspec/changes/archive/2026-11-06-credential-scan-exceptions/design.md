## Context

`scanDiff` returns findings `{file, line, kind, detail}` without the line text; `commit-change` and `validation-gate` both call it. `.relevo/` is already a hard-protected path, and `commit-change` refuses it, which gives the protection of constraint C2 for free if the list is read only from committed content.

## Decisions

- **JSON file `.relevo/scan-exceptions.json`**: `yaml-lite` has no list of maps; JSON needs no new parser. Shape: `{"exceptions":[{"path":"src/schema.ts","pattern":"password: z.string","reason":"form schema, no value"}]}`.
- **Match by path glob (existing `matchesGlob`) and a literal substring of the added line**, never a line number. Literal, not regex, to avoid ReDoS and surprise.
- **Broadness rules**: path ends in `/`, contains `**`, or its file name is `*`; pattern shorter than 8 characters; empty reason. Such entries are invalid and reported, never applied. An unreadable or malformed file applies nothing (strict, fail closed).
- **Credentials only**: markers are never excepted, so the exception cannot weaken the marker check.
- **Source of truth**: `git show HEAD:<file>` for commits, `git show <base>:<file>` for the gate. A working-tree edit by the agent has no effect, and its commit would be refused as a protected path anyway.
- **API**: new `scripts/lib/scan-exceptions.mjs` with `parseExceptions(text)`, `applyExceptions(diff, exceptions)` returning `{findings, applied, refused}`. `scanDiff` is unchanged. `scan.mjs` exports a small helper to scan with line text so matching sees the line.
- **Reporting**: `commitChange` returns `exceptions: [{path, reason}]`; the CLI keeps the hash on stdout and prints `scan exceptions applied: N` lines on stderr, which the go skill adds to the run comment. The gate receipt detail lists them.

## Risks

- A person lists a pattern that also covers a real secret on the same file: mitigated by the 8 character minimum, review of the file in a pull request, and the exception applying only to a line containing the pattern.
