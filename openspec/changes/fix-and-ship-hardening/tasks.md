# Tasks

## 1. `fix`

- [ ] 1.1 Add `scripts/lib/fix-stash.mjs` and `scripts/fix-stash.mjs` (`save`, `find`, `pop`, `drop`; message `relevo-fix #<n> iteration <k>`; `save` refuses a clean tree; `pop` keeps the stash and lists the conflicting files). Verify with `tests/fix-stash.test.mjs` in a throwaway repository: save leaves the tree clean and names the stash, find returns the newest of the issue and ignores other stashes and other issues, pop restores, a conflicting pop exits 1 and the stash is still listed, drop removes only the matching one.
- [ ] 1.2 Add `scripts/lib/branch-work.mjs` and `scripts/branch-work.mjs --base <branch> --change <folder>` (exit 1 when nothing outside the change folder differs). Verify with `tests/branch-work.test.mjs`: only specification files, a code file, an empty diff, a file with a similar prefix outside the folder.
- [ ] 1.3 Add `correctionSection` to `scripts/lib/tasks-file.mjs` and `scripts/fix-tasks.mjs --file <tasks.md> --stage before|after`. Verify with additions to the tasks tests and `tests/fix-tasks.test.mjs`: an old task open, corrections only, no test task, `(device only)`, all done, a correction left open, a file with no correction section.
- [ ] 1.4 Update `skills/fix/SKILL.md`: stash offer in the preflight, the branch check, the task checks before the developer and before the commit, the stash on a rejected QA, and the `Test:` convention. Verify with additions to `tests/skill-fix.test.mjs`: each script named exists, its flags are implemented, the commit step comes after the `after` check, and the stash sentence is present.

## 2. `ship`

- [ ] 2.1 Extend `scripts/lib/ship.mjs` and `scripts/ship-check.mjs`: `headRefOid` and the review commit in the fields, `--baseline`, `--labels`, the state table, the eligibility rules and the `not-approver` confirm, `summary.warnings`. Verify with additions to `tests/ship.test.mjs`: every scenario of the `ship` delta (approval on an old commit, on the baseline, on the head, a review without a commit, a built issue, a qa-failed issue, a pr-open issue, the spec writer, a person outside the team, an eligible person who did not approve, approver in `roles`), and the existing cases unchanged when the new inputs are absent.
- [ ] 2.2 Add `scripts/lib/archive-state.mjs` and `scripts/archive-state.mjs --change <folder>`. Verify with `tests/archive-state.test.mjs`: active, archived with a date prefix, missing, a change whose name ends like another one.
- [ ] 2.3 Add `scripts/conflict-scope.mjs` (exit 0 when all conflicted paths are under `openspec/`). Verify with `tests/conflict-scope.test.mjs` in a throwaway repository with a real merge conflict inside `openspec/` and one in code, and with paths on stdin.
- [ ] 2.4 Update `skills/ship/SKILL.md`: the state and baseline in step 1, `archive-state` and the validation in step 3, the revert-and-archive-again recovery and `conflict-scope`, the `not-approver` confirmation, a second `ship-check` with `--baseline`. Verify with additions to `tests/skill-ship.test.mjs`: each script named exists and its flags are implemented, the confirmation step comes before the archive, no force push is mentioned as allowed.

## 3. Documentation and integration

- [ ] 3.1 Update `docs/commands.md` and `docs/commands.es.md` (stash on a failed fix, the checks, who may run `ship`, running `ship` again) and `CHANGELOG.md`. Verify with `tests/readme-sync.test.mjs` and the changelog test.
- [ ] 3.2 Run `node --test tests/*.test.mjs` and `openspec validate --all`; both must pass.
- [ ] 3.3 Try the pieces that can be tried without a second person on the sandbox: a `fix` that QA rejects (stash saved, tree clean, restored on the next start), `archive-state` on a real archived change, and `ship-check` on a real pull request reading the commit of its reviews. Record what happened in `docs/pilot-findings.md`, including what could not be tried (the archive conflict, a second approver).
