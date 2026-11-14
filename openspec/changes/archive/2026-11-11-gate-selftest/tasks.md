## 1. Library

- [x] 1.1 `scripts/lib/gate-selftest.mjs`: the case table per stack (unit seeds, story seed when the test command runs Playwright, docs case), `planCases(profile, testCommand)` returning seeded or skipped with reason, the verdict of a case, the report renderer and the instructions renderer, the remote recipe footer
- [x] 1.2 Decide "not Relevo's CI" (no config, platform not resolved, no `test` command)

## 2. Command

- [x] 2.1 `scripts/gate-selftest.mjs`: arguments (`--base`, `--platform`, `--config`), detached worktree, symlinks of installed paths, seed, gate subprocess, verdict, cleanup in `finally`
- [x] 2.2 Exit codes and messages

## 3. Tests

- [x] 3.1 Unit tests of the library (plan, skipped reasons, verdicts, instructions, footer)
- [x] 3.2 Integration test in a temporary repository: three cases, report, exit code, branches/base ref/working tree unchanged, no worktree left, instructions mode, story skipped, `unexpected` for a check that ignores the seed, cleanup after a failure

## 4. Docs

- [x] 4.1 Section in `docs/commands.md` and `docs/commands.es.md` with the recipe
- [x] 4.2 One line under `[Unreleased]` in `CHANGELOG.md`; run `npm test` and `openspec validate --all`
