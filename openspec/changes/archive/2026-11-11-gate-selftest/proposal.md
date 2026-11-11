## Why

To check that a CI aggregate and the validation gate behaved correctly on a broken spec, a broken story and a docs-only change, the pilot team opened three throwaway pull requests marked "do not merge", waited for CI and closed them. A CI that decides whether a repository skips tests, and how a failure surfaces, needs this check, and every Relevo-managed repository will repeat it (issue #131, part of #115).

## What Changes

- A new command, `scripts/gate-selftest.mjs`, seeds three cases (a failing unit test, a failing browser story, a docs-only change) in a scratch worktree, runs `scripts/validation-gate.mjs` on each, and prints what the gate did and whether that is what the case expects.
- The scratch worktree is detached from the base ref and is removed at the end. The command never writes to the base branch or to the working tree of the repository and creates no branch, so nothing is left behind.
- A case that cannot be seeded in the stack is skipped and the report says why.
- In a repository whose CI is not Relevo's (no `relevo.yml`, a platform that does not resolve, or no `test` check) the command runs nothing and prints the cases as instructions.
- The report ends with the steps to see the remote CI aggregate on the same cases by hand on a scratch branch, with the cleanup commands.
- A documented recipe in `docs/` (English and Spanish) and a changelog entry.

Out of scope: testing the project's own tests; pushing branches or opening pull requests (the remote CI aggregate is a printed recipe, not an action); reuse of the lens cases of `eval-lenses.mjs`, which seed defects for a model to find, not failures of a check (see the design).

## Capabilities

### New Capabilities

- `gate-selftest`: a command that exercises the main paths of the gate on seeded cases without touching the base branch.

### Modified Capabilities

None.

## Impact

New `scripts/gate-selftest.mjs`, `scripts/lib/gate-selftest.mjs`, `tests/gate-selftest.test.mjs`, a section in `docs/commands.md` and `docs/commands.es.md`, and one line in `CHANGELOG.md`. No change to the gate, the skills or the version.
