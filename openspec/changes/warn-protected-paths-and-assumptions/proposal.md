# Proposal

## Why

Two findings of the pilot (#119 and #122, children of #115) are the same kind of problem: something that a run cannot or should not decide is only noticed late. Three issues had a task that edits the project rules file, a protected path that an unattended run never changes; the build preflight now catches it during specification, but the person learns it only after marking the issue ready, and when the commit guard refuses it later the comment says "QA rejected after the retries", which is not what happened. Two builds listed backend permission names as "not confirmed" assumptions and went on, against a project rule that says not to invent names; and one build added a shared component for a single screen without the hand-off saying so.

## What Changes

- **A draft warns about protected paths while it is written (#119).** `check-issue.mjs` adds warnings (never problems) for a rules file, workflow, `relevo.yml`, skill folder or dependency manifest that the issue text names and that `Allow-paths:` does not cover: a path that a line asks to change, and a hard-protected path that is only named in prose. The warning says why and offers the two ways out (a person makes the edit, or the task is rewritten), plus `Allow-paths:` for a dependency manifest. The decision comes from `protected-paths.mjs`, the same code that enforces the guard. `skills/issue/SKILL.md` and `references/update.md` tell the writer to ask how to proceed.
- **A refused protected path names the policy (#119).** A run that ends because the commit guard refused a protected path no longer says "QA still rejected it after the retries": the `qa-failed` comment says that an unattended run cannot edit that path and that QA did not judge the work, and its next step is `/relevo:issue`, not a rebuild. The hint of the `needs-spec` reason `policy` stops talking only about dependency manifests: it says that a person makes the edit or the issue changes, and that only a dependency manifest can be allowed.
- **Assumptions about names outside the repository are confirmed or listed (#122).** A script reads the assumptions (those of the issue, and those the specification wrote in `design.md`), picks the ones that name something that exists outside the repository (a permission, endpoint, field, claim...), looks for each name in the repository, drops the ones it finds and lists the rest. The check of a draft warns about them and the issue skill asks to confirm, keep them as a `manual` external input, or turn them into an open question (which makes the build wait). The spec check of the preflight lists the rest in the hand-off, near the top, as `Assumed, not confirmed`; the build is not stopped.
- **The hand-off lists the shared code that the build touched (#122).** A new script lists the added or modified files that are used by more than one file (from the import graph of the diff and the tree) or that live in a shared folder (a path rule), and `go` puts the list in the hand-off as `Shared code touched`. Nothing is blocked.

## Capabilities

### New Capabilities

### Modified Capabilities
- `issue`: the check of a draft warns about protected paths named in the text and about assumptions that name something outside the repository.
- `issue-lifecycle`: the next step of `policy` covers protected paths; the `qa-failed` comment for a refused protected path names the policy; the hand-off carries the assumptions and the shared code.
- `go`: the spec check lists unsettled assumptions; a script lists shared code for the hand-off.

## Impact

New `scripts/lib/protected-mentions.mjs`, `scripts/lib/assumptions.mjs`, `scripts/lib/shared-code.mjs`, `scripts/shared-code.mjs`; changed `scripts/lib/issue-check.mjs` and `scripts/check-issue.mjs` (focused blocks), `scripts/lib/build-preflight.mjs` and `scripts/build-preflight.mjs` (spec stage), `scripts/lib/next-step.mjs`, `scripts/lib/messages.mjs` (hand-off lines, `qa_failed` wording), `skills/issue/SKILL.md` and `skills/issue/references/update.md`, `skills/go/SKILL.md` (two short additions in step 7 and in the failure path), `templates/issue.md` (a comment), `docs/issue-format.md` and `docs/issue-format.es.md`, tests, `CHANGELOG.md` (unreleased). Not touched: `scripts/validation-gate.mjs`, the test-run script and `skills/go/references/qa-run.md` (issue #124, in parallel), the version in `plugin.json`, any guard of protected paths (the guards stay as they are; constraints #119 C1, #122 C1 and tracking C2).
