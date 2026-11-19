## Context

The gate (`scripts/validation-gate.mjs`) runs the `analyze` and `test` checks of the platform profile on the diff against a base and writes a receipt. The pilot used three throwaway pull requests to see how the gate and the CI aggregate treat a failing unit test, a failing browser story and a docs-only change.

## Goals / Non-Goals

**Goals:** one command, no network, no branch, no write to the repository; honest output when a case cannot be seeded; the same command usable by any Relevo repository.

**Non-Goals:** running or pushing remote CI; testing the project's own tests.

## Decisions

- **Scratch = `git worktree add --detach <tmp> <base>`.** A detached worktree creates no branch and shares the object store, so removing it (`worktree remove --force`, then the directory) leaves the repository as it was. The base defaults to `origin/<default>` as the gate does and is overridable with `--base`. Alternative considered: a copy of the repository in a temp folder; heavier and breaks relative `relevo.yml` paths less clearly.
- **The gate runs as a subprocess in the worktree** with `--config <worktree>/relevo.yml`, `--base <base>` and `--files` for the seeded files, so the command tests the real gate and its real exit codes. Installed paths of the profile (`node_modules`, `vendor`) are symlinked from the repository into the worktree so the checks can run; the links are inside the scratch folder and go with it.
- **The gate writes its receipt in the worktree** (`.relevo-receipt/`), which is deleted with it.
- **Seeds are a table per stack in `scripts/lib/gate-selftest.mjs`** (`vue`, `flutter`, `laravel`, `supabase`): the path and content of a failing unit test the stack's `test` check runs. The browser story is seedable only when the resolved `test` command mentions `playwright` (a Playwright spec); otherwise it is skipped with the reason. A stack without a table entry skips the unit case the same way. The docs-only case writes `docs/relevo-selftest.md`.
- **Expectations are part of the case**: unit and story `red`, docs `green`. A mismatch is `unexpected`, which is also how a check that does not run the seeded test is revealed.
- **"Not Relevo's CI"** is decided from what the gate needs: `relevo.yml` loads, the platform resolves, the profile has a `test` command. Otherwise the cases are printed as instructions.
- **The remote CI aggregate is a printed recipe.** Pushing, waiting for CI and deleting a remote branch needs credentials, time and a base-branch policy; the command only prints the `git push`/`gh` commands and the deletion. This keeps C1 true by construction.
- **No reuse of `eval-lenses` cases.** Those cases are source files with a seeded defect for a model to find (`bad/` and `good/`), they carry no stack test that fails; sharing them would mean running a test runner on fixtures that are not tests. The sharing the issue allows ("where it makes sense") does not apply, so the seeds live in the new lib.
- **Exit codes:** 0 all agreed or instructions printed, 1 some case unexpected or could-not-run, 3 bad arguments (as the gate).

## Risks / Trade-offs

- Seeds are per stack and can drift from conventions of a project (a different test runner): the `unexpected` verdict says so instead of passing quietly.
- A repository without an `origin/<base>` ref: the command stops with a usage message and writes nothing.
