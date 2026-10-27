# Design

## Context

- A result is `{ id, status, message, fix }`, built by `pass`, `warn` and `fail` in `scripts/lib/doctor.mjs`. `renderReport` prints one line per result and the `fix` line under a failure or warning. `scripts/doctor.mjs` prints that text, or the results as JSON with `--json`, and exits 1 only when a result failed. The only consumers of the results are `scripts/doctor.mjs` and `relevo doctor`, which prints its output (`scripts/cli.mjs`).
- Informational lines are built with `pass`: `execution.policy` ("reminder: read the current Anthropic terms…"), the reserved-skill line of `skills.<name>` ("a notice, not a problem"), the iOS-on-macOS target line, and `execution.credential` for a subscription token.
- Per-file checks emit one result per workflow (`automation.workflow.<file>`, and, since 0.8.0, `automation.runner.<file>`). The facts already know what was judged: `f.repo`, `f.defaultBranch` and `f.workflowSource` (`default branch (main)` or `working copy`).
- See proposal.md - Why for the sample that motivated the change.

## Goals / Non-Goals

**Goals:**
- The first screen of the report is what needs action, and nothing that is the same cause twice.
- The same checks, the same exit status and the same `--json` as today, plus one level.

**Non-Goals:**
- Removing, merging or adding checks, or changing what any check verifies.
- Colour, a `--quiet` mode, or a different exit status for warnings.
- A grouped JSON: a program reads every result, and grouping is for people.

## Decisions

### D1. Sections in the text report, with a count for the passes

The report is a header, then `FAILURES (n)`, `WARNINGS (n)` and `NOTES (n)` (a section with nothing is left out), then one closing line: how many checks passed, and `--all` to list them. With `--all` the report is the list as it is today, in the order evaluated, under the same header and closing summary.

Alternative: keep one flat list and sort it. Rejected: the passes would still be most of it. Alternative: sections by area (tools, repository, workflows). Rejected for now: the checks have no area field, and adding one touches every check; the ids already start with the area (`tools.`, `automation.`, …), so it can be done later without changing the contract.

### D2. `note` is a level, not a flag on `pass`

`note(id, message)` joins `pass`, `warn` and `fail`. The four lines above change their builder and nothing else. A note never affects the exit status, the count of failures or the count of warnings.

Alternative: leave them as `pass` and filter by text. Rejected: a text filter is the kind of thing that breaks when a message is reworded. Alternative: drop them. Rejected: the reminder about the terms of a subscription token is there on purpose.

### D3. The check emits one result per cause

The runner check builds one failure that names every differing file, so the cause is one result at the source. There is no generic merger in the renderer, because the fix text of a per-file result contains the file name and a merger would have to guess which results are "the same". The same is done for `automation.workflow.<file>` when several files share the status and the fix.

The summary counts results (`2 checks failed`), which is what the person has to fix.

Alternative: a `group` field and a merge in `renderReport`. Rejected for the reason above; it can be added if a later check needs it.

### D4. The header says what was judged

`Relevo doctor: owner/repo, workflows read from the default branch main` or `…from the working copy`. It reuses `f.workflowSource`. When there is no repository (no `gh` sign-in), it says that only local checks ran.

### D5. `--all` and `--json`

`--all` is a flag of the text report only. `--json` already lists every check and does not take `--all`; it gains the value `note` in `status`. The skill is told that `note` exists.

## Risks / Trade-offs

- [A person who parses the text report finds a new layout] → `--json` is the interface for programs; the changelog says so and `--all` keeps the old lines.
- [A passing check hides a problem the person wanted to see] → the closing line gives the count and names `--all`; a check that the person must act on is a warning or a failure, never a pass.
- [Moving a line from `pass` to `note` changes the count of passed checks] → it is a plain count in the closing line, and no test or document depends on it except the ones listed in the tasks.
- [Grouping per cause makes a result longer] → one line with the files, one fix, instead of N lines.

## Migration Plan

1. Release as a minor or a patch of the next version; nothing to migrate. The exit status and `--json` are as before.
2. Rollback: revert the commit; no data or configuration changed.

## Open Questions

- None that change the specs. Whether to add an `area` field to every check, to group the report by area, can wait for a later change.
