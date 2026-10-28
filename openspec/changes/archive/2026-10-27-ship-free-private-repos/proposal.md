# Proposal

## Why

On a private repository on GitHub's free plan there are no rulesets and no branch protection, and the endpoints that report them answer HTTP 403 ("Upgrade to GitHub Pro or make this repository public to enable this feature"). The unattended ship (`relevo:ship` label) reads those endpoints to know whether the base branch requires checks; the 403 is not handled, so the run dies with a stack trace and the person is told only that it "ended without an outcome". Such a repository requires no checks, and the ship should treat it as one.

Two more faults surfaced in the same run: the ship workflow template lacks the permissions to read the check results of a commit (`Resource not accessible by integration (statusCheckRollup)`), and `doctor` reports the free plan as a warning although the person can do nothing about it but upgrade.

## What Changes

- `requiredChecks` treats the plan/visibility 403 (status 403 **and** the "Upgrade to GitHub Pro" / "make this repository public" text) as "no required checks", for both the ruleset endpoint and the classic protection endpoint. Every other error (a 403 for permissions, 404 on the rules endpoint, 5xx) still stops the run.
- The unattended ship turns any unexpected error into a stop: it comments the concrete reason (the message of `gh`) on the issue and removes the `ship` label, instead of dying with a stack trace.
- With no required checks the ship keeps every other pre-merge check (approved, not draft, mergeable, checks of the head green); only the absence of rules stops being an error.
- The `relevo-ship.yml` template declares `checks: read` and `statuses: read`.
- `doctor` reports a repository whose plan offers no branch protection as a note, not a warning.
- Patch release 0.9.2 of the package and the templates (0.9.1 is already published), with a changelog entry.

## Capabilities

### New Capabilities

### Modified Capabilities

- `ship`: the unattended ship treats a base branch with no rules available as one with no required checks, and says the concrete reason when an unexpected error stops it.
- `init-doctor`: `doctor` reports branch protection unavailable on the plan as a note.

## Impact

- `scripts/lib/ship-github.mjs`, `scripts/lib/ship-unattended.mjs`, `scripts/lib/doctor.mjs` and their tests (`tests/ship-github.test.mjs`, `tests/ship-unattended.test.mjs`, `tests/doctor.test.mjs`, `tests/workflow-ship.test.mjs`).
- `templates/workflows/relevo-ship.yml` (permissions, template version, `RELEVO_VERSION`) and the version line of the other templates.
- `package.json`, `.claude-plugin/plugin.json`, `CHANGELOG.md`; docs that mention the free plan or the default-branch requirement of the workflow.
- A consumer adopts the fix by setting `RELEVO_VERSION` to `0.9.2` in its `.github/workflows/relevo-ship.yml`.
- Out of scope: running `ship` without protections in any other way, and `init` (it already lists protection as manual when unavailable).
