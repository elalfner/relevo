## Context

Three frictions from one run on 0.17.2, each traced in the code.

- `mergeProfiles` (`scripts/lib/stack-profile.mjs`) keeps the plugin's value for a `commands.*` or `targets.*` key and records the repository's value in `ignored`. `doctor` already warns from that list, but `stack-profile.mjs` prints it as plain JSON and `validation-gate.mjs` prints `<name> failed: <command>` and nothing more. `applyChecks` is the only way to replace a command (`platforms.<name>.checks`).
- `fix-stash.mjs save` runs `git stash push --include-untracked`. A file marked by `intent-to-add.mjs` has an empty entry in the index (` A` in `status --porcelain`), and git refuses to stash it.
- When `checkpoint.mjs` is refused by `commit-change` it returns `unsafe`. The failure path then gives `branch_state` `unsafe`, `messages.mjs` writes "NOT pushed" and `buildFailedReason` picks `rebuild`, whose hint is `/relevo:go <n> --retry`. That is true only when no checkpoint was pushed. The planner refuses the retry once the branch has code (`retry-refusal.mjs`), and `isWipCommit` already treats `wip: checkpoint <k>/<n>` as kept work, so `fix` already needs no description of the defect.

## Goals / Non-Goals

**Goals:**
- Make each cause visible where the person looks: the red gate, the profile output, the failure comment, the refused retry.
- Fix `save` with the smallest git operation that works.
- Tests for each change, and notes for 0.17.3.

**Non-Goals:**
- Letting a repository profile replace a command. The gate must not be weakened by a profile.
- Changing the push per checkpoint, the rules of the retry planner, or `fix`'s code.
- Committing the files of the rejected group.

## Decisions

**1. The warning is derived from `ignored`, once, in the library.** A function in `scripts/lib/stack-profile.mjs` turns each `ignored` entry whose key starts with `commands.` into a warning object and a sentence (`key`, `asked`, `kept`, `text`). `stack-profile.mjs` prints the objects as `warnings` in its default output, next to `ignored`, which stays. `validation-gate.mjs` prints the sentence of a key only when that command is in the red set, so a failing `analyze` does not mention an ignored `test`. A key that `platforms.<name>.checks` already replaces is not reported (`overridden`): the repository's value is moot there. Alternative: print every ignored key on every red gate. Rejected: noise unrelated to the failure.

The gate output stays a list of lines; the new sentence is one extra line per ignored failing command, after its `failed:` line. The receipt (`.relevo-receipt/`) does not change, so the lenses and the reuse of a green check are untouched.

**2. `save` unmarks by status code, not by `git reset` of everything.** It reads `git status --porcelain=v1 -z`, collects the paths whose code is exactly ` A`, and runs `git reset -q -- <paths>` for them. A real staged add is `A ` (or `AM`) and is not selected, and `git reset -q -- <paths>` on an intent-to-add path only removes the empty entry. The `-z` form handles names with spaces and quotes. Alternative: `git reset -q` of the whole tree. Rejected: it would unstage content someone staged on purpose. Alternative: `git stash push` without `--include-untracked`. Rejected: it would leave the new files in the tree.

**3. A partial push is a new reason, not a new `branch_state`.** `branch_state` keeps its four values; what is new is a `partial` reason for `build-failed` in `next-step.mjs` with command `/relevo:fix {n}` and hints in English and Spanish, and optional values of the `build_failed` message: `pushed_groups` (for example `1-3`), `refused_group` and `of_groups`, `refused_path`, `refused_reason`, and `allow_line`. When `pushed_groups` is present and `branch_state` is `unsafe`, `messages.mjs`:
- writes a branch line that names the pushed groups and the refused one instead of "NOT pushed",
- gives the next step `partial` instead of `rebuild`,
- adds a line with the refused path and, when one is given, `allow_line`.

Keeping `unsafe` avoids touching the branches of `messages.mjs` that read it, and an unchanged message for the first checkpoint is guaranteed because `pushed_groups` is then absent.

**4. The skill computes the facts; the message only prints them.** In the failure path, `skills/go/SKILL.md` says: when the reason comes from a refused checkpoint (exit 1 of `checkpoint.mjs`) and its `k` is above 1, pass `pushed_groups` `1-<k-1>`, `refused_group` `<k>`, `of_groups` `<n>`, the refused path from the detail of the script, and `allow_line` `Allow-paths: <path>` only when the refusal is `outside the platform` or a dependency file (the two the person can allow in the issue). A restricted file, a credential and a protected path of the hard tier get no `allow_line`. The detail text of the script already carries `list the path in an Allow-paths: line`, so the skill takes the path from it.

**5. The refused retry gets a third text, for `implementation`.** `retryRefusal` already receives `kind` from `readBranchKind`. For `implementation` it says the branch holds code, names `/relevo:fix <n>` and says no defect description is needed when the branch ends at a commit that `go` made for a build that did not finish. `null` (cannot be read) and `empty` keep the current text.

**6. Fix needs a test, not code.** `failure-comment.mjs` already reports `kept` for `wip: checkpoint <k>/<n> (#<issue>)` through `isCheckpoint`. A test pins it, including that a checkpoint of another issue does not count.

**7. Docs.** `docs/stacks.md` and `docs/stacks.es.md` get a paragraph in the section on repository profiles: a repository profile cannot replace a command of the plugin, `stack-profile.mjs` and a red gate say so, and `platforms.<name>.checks` is the way, with a short example for `test`.

## Risks / Trade-offs

- [The files of the refused group stay uncommitted in the worktree of the run] → the notes of 0.17.3 say so. A person who runs `fix` in another clone does not have them. The comment names the refused path so they can be recovered by hand.
- [`pushed_groups` assumes groups 1 to k-1 were pushed] → a group with no change makes no commit (`nothing`) and a checkpoint can be `not_pushed`. The skill reads the checkpoints on the remote (`git log` of the branch) instead of assuming, and passes only the numbers it finds; with none found the message stays as before.
- [A new message value that a catalog test does not know] → `tests/messages-language.test.mjs` runs both languages, so the Spanish text is required in the same change.
- [`validation-gate.mjs` output is read by scripts] → the new line comes after the `failed:` lines and the exit codes do not change; the tests that read the gate output are run unchanged.

## Migration Plan

No data or configuration migrates. The release is `0.17.3`: version in `.claude-plugin/plugin.json`, template stamps and pins, and `CHANGELOG.md` with one line per change under `### Fixed`, plus the note about the uncommitted files of the rejected group. After the merge the person tags `v0.17.3` on `main`, as in `RELEASING.md`.

## Open Questions

None. The scope was confirmed: only `platforms.<name>.checks` replaces commands, and the push per checkpoint stays.
