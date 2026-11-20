## 1. An ignored command is visible (platforms, validation-gate)

- [x] 1.1 In `scripts/lib/stack-profile.mjs`, add a function that turns each `ignored` entry with a `commands.` key into a warning (`key`, `asked`, `kept`, `text` naming `platforms.<name>.checks`), skipping a key that `overridden` already replaces; export it
- [x] 1.2 In `scripts/stack-profile.mjs`, print `warnings` in the default output next to `ignored` (empty list when nothing is ignored), leaving `ignored` and every other output as they are
- [x] 1.3 In `scripts/validation-gate.mjs`, after each `<name> failed: <command>` line of a red result, print the sentence of the warning of that same command when there is one; no change to green, `could-not-run`, the receipt or the exit codes
- [x] 1.4 Tests in `tests/stack-profile.test.mjs`: repository sets `commands.test` against the plugin's gives a warning with both values and `platforms.<name>.checks`; a command only the repository defines gives none; no repository profile gives `warnings: []`; a key replaced by `checks` gives none
- [x] 1.5 Tests in `tests/validation-gate.test.mjs`: red with an ignored failing `test` prints the sentence; red with an ignored `test` while `analyze` fails does not mention `test`; red with nothing ignored prints what it printed before
- [x] 1.6 Document the rule in `docs/stacks.md` and `docs/stacks.es.md` (a repository profile cannot replace a command; the gate and `stack-profile.mjs` say so; use `platforms.<name>.checks`, with an example for `test`); run `tests/stacks-docs*` or the docs tests to confirm both languages agree

## 2. `fix-stash save` with intent-to-add files (fix)

- [x] 2.1 In `scripts/fix-stash.mjs`, before `git stash push`, read `git status --porcelain=v1 -z`, collect paths with code exactly ` A`, and run `git reset -q -- <paths>` for them only (nothing when there are none)
- [x] 2.2 Tests in `tests/fix-stash.test.mjs`: a new file marked with `intent-to-add.mjs` then `save` exits 0, names the stash and leaves a clean tree; `pop` brings the file back with its content; a file with staged content is not unstaged by the step (it is in the stash, and its entry was not reset first)

## 3. A refused checkpoint after earlier checkpoints (go)

- [x] 3.1 In `scripts/lib/next-step.mjs`, add the reason `partial` for `build-failed` (command `/relevo:fix {n}`, assignee, hint in English and Spanish saying the pushed groups are on the branch and the refused one is not), and add it to `NEXT_STEP_REASONS` and to the doc comment of `nextStep`
- [x] 3.2 In `scripts/lib/messages.mjs`, accept the optional `pushed_groups`, `refused_group`, `of_groups`, `refused_path`, `refused_reason` and `allow_line` of `build_failed`; when `branch_state` is `unsafe` and `pushed_groups` is present, write the branch line naming the pushed groups and the refused one (not "NOT pushed"), choose the reason `partial`, and add a line with the path, the reason and `allow_line` when given; English and Spanish; with `pushed_groups` absent the output is byte for byte what it is today
- [x] 3.3 Tests in `tests/messages.test.mjs` and `tests/next-step.test.mjs`: group 4 of 4 refused after 1-3 pushed names both, the path, `Allow-paths: <path>` and `/relevo:fix`, and contains neither "NOT pushed" nor `--retry`, in both languages; first checkpoint refused (no `pushed_groups`) is unchanged; a refusal with no `allow_line` gives no `Allow-paths:`; `partial` is a valid reason; `tests/messages-language.test.mjs` passes
- [x] 3.4 In `skills/go/SKILL.md` (failure path, and the checkpoint paragraph that handles exit 1), say how to compute the values: read the checkpoints of the branch on the remote, pass `pushed_groups`, `refused_group`, `of_groups`, the path from the detail of the script, and `allow_line` only for `outside the platform` and dependency files; never for a restricted file, a credential or a hard-protected path. Add the new reason to the lists of `next-step.mjs` reasons in the skill
- [x] 3.5 Test in `tests/skill-go.test.mjs` that the text of the skill names `pushed_groups`, `allow_line` and `partial`, and still says that the push per checkpoint is a fast-forward

## 4. A refused retry on a branch with checkpoints (go)

- [x] 4.1 In `scripts/lib/retry-refusal.mjs`, add the text for `kind === 'implementation'`: the branch holds code, `/relevo:fix <n>`, and no defect description is needed after an interrupted build; `spec-only`, `empty` and `null` keep their text
- [x] 4.2 Tests in `tests/retry-refusal.test.mjs`: `implementation` names `/relevo:fix 20` and says no description is needed; `spec-only` and `null` are unchanged; the branch is not modified (the function only returns text)

## 5. `fix` closes an interrupted build without a defect (fix)

- [x] 5.1 Add `tests/failure-comment.test.mjs` (or extend the existing file for that library): a subject `wip: checkpoint 3/4 (#20)` with a failure comment gives `kept: true`; the same subject of another issue, and a commit of a person, give `kept: false`; make no change to `failure-comment.mjs` or to `skills/fix/SKILL.md` unless a test shows it is wrong

## 6. Release 0.17.3

- [x] 6.1 Bump the version in `package.json` and `.claude-plugin/plugin.json`, set `RELEVO_VERSION` and the `# relevo-template:` line of the six templates in `templates/workflows/`, and update `skills-lock.json` if the repository's checks require it
- [x] 6.2 In `CHANGELOG.md`, add `## [0.17.3]` with `### Fixed` and one line per change: the red gate and `stack-profile.mjs` `warnings` for an ignored command (rule unchanged, `platforms.<name>.checks` still the only way); `fix-stash.mjs save` with intent-to-add files; the `build_failed` comment after a refused checkpoint (pushed and refused groups, the path with its `Allow-paths:` line, `/relevo:fix`); the `--retry` refusal on a branch with checkpoints; the `fix` after an interrupted build pinned by a test. Add a `### Known limits` line: the files of the rejected group stay uncommitted in the worktree
- [x] 6.3 Run `npm test` and `openspec validate --all`, and fix anything they report before pushing
