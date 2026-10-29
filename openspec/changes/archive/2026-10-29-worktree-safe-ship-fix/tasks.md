# Tasks

## 1. The branch-worktree check

- [x] 1.1 Add `scripts/lib/branch-worktree.mjs` (parse `git worktree list --porcelain`; a worktree that holds `refs/heads/<branch>` and is not the current one is "holding"; a detached worktree holds nothing) and `scripts/branch-worktree.mjs --branch <name>` (exit 0 free or held here, exit 1 prints the path, exit 2 bad usage). Verify with a new `tests/branch-worktree.test.mjs` using a fake runner: free branch, branch held here, branch held by another worktree (path printed), detached worktree, not a git repository, missing `--branch`.
- [x] 1.2 `skills/review/SKILL.md` step 1, `skills/fix/SKILL.md` and `skills/ship/SKILL.md` step 1: run the script before `git switch <branch>`; on exit 1 stop with the fixed message (the branch is held by that worktree, its path, remove it or work there) and, for `review`, leave the issue `built`. Verify by adding the matching `Scenario:` tests to `tests/skill-review.test.mjs`, `tests/skill-fix.test.mjs` and `tests/skill-ship.test.mjs` (the script is run before the switch; every script the skill runs exists), and that `npm test` passes.

## 2. The tidy of ship

- [x] 2.1 `skills/ship/SKILL.md` step 6.3: run the switch, the fast-forward pull and `git branch -d <branch>` only under the condition of `review` step 9 (git dir equals the common dir and no worktree holds `<base>`); otherwise run nothing, say which branch the working tree stays on, and treat a failing command as a note that does not change the report. Verify with `tests/skill-ship.test.mjs` scenarios "Ship in a worktree" and "The tidy fails" (the condition is the same text as in `review`, the failed tidy never undoes the merge), and that `npm test` passes.

## 3. The documentation

- [x] 3.1 `docs/execution.md`: under "Building on your machine", a section "Worktrees from your base branch" with the recipe (what the button does, the hook script that finds the main checkout with `--git-common-dir`, the settings entry, what the hook gives up, that `/relevo:init` does not install it, that it was verified on Claude Desktop only, one sentence on `worktree.baseRef: "head"` and why it is not recommended); one paragraph saying that `review`, `ship` and `fix` also run in a worktree and what they skip there; and one sentence in "Several runners on one machine" about a runner under the person's own user sharing `~/.claude` with their interactive sessions. Verify by reading the page and running `node --test tests/docs-claims.test.mjs`.
- [x] 3.2 `docs/execution.es.md`: the same, with the same headings, commands and links. Verify with `node --test tests/docs-claims.test.mjs` (both languages have the same headings and commands) and `openspec validate worktree-safe-ship-fix`.

## 4. Integration checks

- [x] 4.1 Run `npm test` and `openspec validate --all`, the two steps of the CI, and run `node scripts/branch-worktree.mjs --branch dev` by hand from a worktree of this repository while another worktree holds `dev`; it must exit 1 and print that worktree's path.

## Workflow follow-up

- Archive the change on `dev` with `/opsx:archive` once merged; the main specs `ship`, `review`, `fix` and `documentation` receive the added requirements.
