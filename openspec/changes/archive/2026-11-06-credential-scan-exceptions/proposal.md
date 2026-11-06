## Why

The scan of the staged diff refused a commit because of a key named `password` in a form validation schema. QA judged it a false positive, yet the build ended with nothing committed or pushed and a person had to repair it by hand. Today nothing says "this line is not a secret" in a way that survives the next run (issue #120, part of #115).

## What Changes

- A reviewed exception list, `.relevo/scan-exceptions.json`: each entry has a `path`, a `pattern` (text that must appear in the added line) and a `reason`.
- `commit-change` and the validation gate drop a credential finding that matches an entry on path and pattern, not on line number. Everything else is refused as before.
- The report says how many exceptions were applied and which (path and reason), so the run comment can show them.
- Entries that are too broad (a folder, `**`, a bare `*`, a short pattern) or have no reason are refused and never applied.
- The list is read from the committed file (HEAD for the commit, the base ref for the gate), never from the working tree, and `.relevo/` is already a protected path, so an unattended run cannot edit it.

Out of scope: disabling the scan, temporary markers (never excepted), and secrets in files outside the diff.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `go`: the "Safe commits" requirement gains reviewed exceptions for credential findings.

## Impact

- `scripts/lib/scan.mjs` (matching), new `scripts/lib/scan-exceptions.mjs` (load, validate, apply), `scripts/lib/commit-change.mjs`, `scripts/commit-change.mjs`, `scripts/validation-gate.mjs`.
- Tests, `docs/security.md` (+ `.es.md`), the go skill text on the refusal, CHANGELOG unreleased entry. No version bump.
