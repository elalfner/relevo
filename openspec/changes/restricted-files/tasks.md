# Tasks

## 1. Confirm by a run what the documentation leaves open

The documentation answers are recorded in design.md; 1.1 to 1.3 were settled by a run.

- [x] 1.1 Tried on macOS: `denyRead: ["**/.env"]` blocks `.env` at the root and at depth for a sandboxed script and leaves other files readable; recorded in design.md. Linux is checked in task 8.2.
- [x] 1.2 Checked in the source of `claude-code-action` at `v1`: the `settings` input is merged into the user-level `~/.claude/settings.json`, not passed as `--settings`; recorded in design.md. A run in the sandbox repository still confirms the sandbox denials (task 8.2).
- [x] 1.3 Tried with `agy` 1.4.4: an exact-path `read_file` deny stops its file tool, a bare name matches only at the workspace root, `**/` matches nothing, and the denial does not reach `cat`; recorded in design.md.

## 2. The list and its matcher

- [ ] 2.1 Add `scripts/lib/restricted-paths.mjs` with the base list, `restrictedList(config)` (base plus `restricted_paths`, never fewer), the `.env.example` exception and `isRestricted(path)`; verify with `tests/restricted-paths.test.mjs` for `.env`, `.env.production`, `.env.example`, `config/private.pem`, `secrets/a.txt` and a project entry.
- [ ] 2.2 Add `restricted_paths` to `scripts/validate-config.mjs` (list of relative paths, no absolute path and none leaving the repository) and refuse a profile that names a restricted path as allowed; verify with cases in `tests/config.test.mjs` for the default, a valid entry, `/etc/passwd`, `../outside` and a profile that tries to lift `.env`.
- [ ] 2.3 Document `restricted_paths` in `docs/configuration.md` and `docs/configuration.es.md`; verify that `tests/docs-claims.test.mjs` passes.

## 3. The failure path in a run

- [ ] 3.1 Make `scripts/commit-change.mjs` refuse a staged restricted path with the reason "restricted file in the diff", naming the path, and unstage it; verify with cases in `tests/commit-change.test.mjs` for a staged `.pem` and a clean diff.
- [ ] 3.2 Fail the run before the build when `git ls-files` lists a restricted file on the base branch; verify with a test that builds a repository with a versioned `.env` and expects `qa-failed` with the reason and the path, and one without it that passes.
- [ ] 3.3 Add the new reason next to "protected path in the diff" in `skills/go/SKILL.md` and in the failure comment (`scripts/failure-comment.mjs`); verify with the existing tests of that script and a case for the new reason.
- [ ] 3.4 Confirm that `scripts/lib/go-worktree.mjs` and every script that copies files into a tree never copy or link a restricted file; verify with a test in `tests/go-worktree.test.mjs` where an ignored `.env` exists in the main folder and the worktree does not contain it.

## 4. Scripts that gather or publish content

- [ ] 4.1 Add `assertNotRestricted` and a filter helper to the module and use them in every script that lists files to attach or publish (captures, digests, evidence); verify with a test per script that a restricted file is left out and that the script says so.
- [ ] 4.2 Review the scripts that read a path they were given (`scan-diff`, `check-issue`, `design-fetch` and the like) and make them refuse a restricted one; verify with one refusal case each.

## 5. Render the denials for each agent

- [ ] 5.1 Render the `Read(...)` denials (and the sandbox read denials, per 1.1 and 1.2) into the Claude step of `templates/workflows/relevo-go.yml` from the list, without the example file; verify with `tests/agent-workflow.test.mjs` that the denials appear and that the two renderings still differ only inside the marked step.
- [ ] 5.2 Add the file-read denials to `agySettings` in `scripts/lib/agent-guard.mjs` if 1.3 found a setting for them, or write the "no control" note into the rendered file if it did not; verify with `tests/agent-guard.test.mjs`.
- [ ] 5.3 Make a new entry in `restricted_paths` show up in the next render of each workflow; verify with a render test that adds an entry and checks both agents.

## 6. Init and doctor

- [ ] 6.1 Make `init` plan the optional item with the deny entries for Claude Code (and for Antigravity if 1.3 allows), show the exact text, merge into the existing settings without removing an entry and write only after a yes; verify with `tests/init.test.mjs` for accepted, declined and existing settings.
- [ ] 6.2 Make `doctor` check the denials by path name, warn for a missing one, fail for a versioned restricted file, and never open a file; verify with `tests/doctor.test.mjs` for the four scenarios of the spec and a test that the file is not opened.

## 7. Skills, stacks and the security page

- [ ] 7.1 Replace the repeated "never read `.env`" sentences in `skills/review/SKILL.md`, `stacks/laravel.md` and any other stack with a pointer to the restricted list; verify with a search that no stack repeats the rule and that `tests/docs-claims.test.mjs` passes.
- [ ] 7.2 Add the restricted-file rows and the three levels to `docs/security.md` and `docs/security.es.md`, with enforced, partial and not-covered per agent and the statement that no ignore file is a control; verify that the page lists the rows of the spec scenario and that `tests/docs-claims.test.mjs` passes.
- [ ] 7.3 Add a `CHANGELOG.md` entry on `dev`; verify with `tests/changelog.test.mjs`.

## 8. Integration

- [ ] 8.1 Run `npm test` and `openspec validate --all` and verify both pass.
- [ ] 8.2 Test in the sandbox repository from `dev` that a run with a restricted file in the diff ends in `qa-failed` with the new reason and that a `Read` of `.env` in the cloud is refused.

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged, then run `npm test` and `openspec validate --all` again.
