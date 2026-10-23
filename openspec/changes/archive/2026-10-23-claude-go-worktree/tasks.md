# Tasks

## 1. Spike

- [x] 1.1 In a scratch repository with the plugin installed, make a worktree with `git worktree add --detach` from `origin/<base>` and, from a skill of the plugin, call `EnterWorktree` with its `path`; record whether it works, whether it asks for something, and the current folder afterwards
- [x] 1.2 From that session, launch `relevo:dev` and `relevo:qa` in the foreground and record the folder they work in and whether their changes land in the worktree
- [x] 1.3 Stop a run midway (abort, then a failing step) and record the folder of the session, the state of the worktree and what `ExitWorktree keep` does
- [x] 1.4 Write the result in `design.md`; if 1.1 or 1.2 fail, change the proposal, the delta spec and the groups below to the fallback (`go-local.mjs`) before going on

## 2. Script

- [x] 2.1 Move the worktree path of `go-local` to a shared module and make `go-local` use it, with its tests unchanged
- [x] 2.2 `scripts/lib/go-worktree.mjs` and `scripts/go-worktree.mjs`: `create <issue>` (path as JSON; a distinct code and message when the path exists or the session is in a linked worktree) and `remove <issue>`
- [x] 2.3 Tests with an injected runner: create, the same issue twice, already in a linked worktree, removal, a missing `origin/<base>`

## 3. Skill

- [x] 3.1 `skills/go/SKILL.md`: a section on the interactive Claude Code run, `create` and `EnterWorktree` by path before the preflight, skip rules, exit and removal on a clean end, keep and print on failure; the failure path mentions the worktree
- [x] 3.2 A test that fixes the rule: the skill names `go-worktree.mjs` before step 0 and skips the worktree for `--decision` and `--local`; the Antigravity rendering still holds its own isolation text

## 4. Documentation

- [x] 4.1 `docs/execution.md` and `docs/execution.es.md`: where an interactive build runs, what `--local` is still for, what happens with the same issue twice and when a run fails
- [x] 4.2 `docs/commands.md` and `docs/commands.es.md`: the `go` entry
- [x] 4.3 Changelog under Unreleased

## 5. Check

- [x] 5.1 `npm test`, `openspec validate --all`, and a run of two `/relevo:go` at once on the scratch repository, recording the result
