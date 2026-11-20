# Proposal

## Why

A repository with its own backend stack profile (`nhost`) hit three frictions in a run of `go`, `fix` and `review` on Relevo 0.17.2. The validation gate went red on a command the repository had tried to replace in its profile, and nothing said why. `fix-stash.mjs save` failed on new files marked with intent-to-add. And a checkpoint refused by the commit guard left the issue `build-failed` with a comment that said nothing was pushed and sent the person to `go --retry`, which the planner refuses because the checkpoints are on the remote. Each is small, and the third sends people down a dead end.

## What Changes

- **A command the repository profile cannot replace is no longer silent.** The rule does not change: only `platforms.<name>.checks` of `relevo.yml` replaces a command, so a repository profile cannot weaken the gate. `stack-profile.mjs` exposes each ignored `commands.*` as a `warnings` entry, `validation-gate.mjs` adds the cause to a red result (the command that ran, the profile's ignored value and `platforms.<name>.checks` as the way), and the profile documentation says it.
- **`fix-stash.mjs save` accepts files marked with intent-to-add.** Before the stash it runs `git reset -q` on the paths marked ` A` in `git status --porcelain=v1 -z` and only on those. A file really staged is left as it is.
- **A refused checkpoint says what is on the remote.** The `build_failed` comment for a refusal after earlier checkpoints names the groups that were pushed and the one that was not, gives the refused path with the `Allow-paths:` line that allows it, and recommends `/relevo:fix <issue>`, not `/relevo:go <issue> --retry`. The push per checkpoint does not change.
- **`go-plan.mjs --retry` on a branch with checkpoints says so.** The refusal states that the branch holds code and that `/relevo:fix <n>` works without describing a defect.
- **A test pins that `fix` closes an interrupted build without a description of the defect**: `failure-comment.mjs` reports `kept` after `wip: checkpoint <k>/<n>`. No code of `fix` changes.
- **Version 0.17.3** with one line per change under `### Fixed` in `CHANGELOG.md`, including that the files of the rejected group stay uncommitted in the worktree.

## Capabilities

### New Capabilities

### Modified Capabilities

- `validation-gate`: a red result names the cause when the profile of the repository tried to replace a command.
- `platforms`: the resolved profile reports each ignored command of the repository as a warning, and the profile documentation states the rule.
- `fix`: saving the work in a stash tolerates intent-to-add files; an interrupted build left at a checkpoint is closed without a description of the defect.
- `go`: a checkpoint refused after earlier checkpoints is reported as a partial push with its recovery, and a refused retry on a branch with checkpoints says to use `fix`.

## Impact

- Scripts: `scripts/validation-gate.mjs`, `scripts/stack-profile.mjs`, `scripts/lib/stack-profile.mjs`, `scripts/fix-stash.mjs`, `scripts/lib/retry-refusal.mjs`, `scripts/lib/messages.mjs`, `scripts/lib/next-step.mjs`.
- Skills: the failure path of `skills/go/SKILL.md`.
- Docs: `docs/stacks.md` and `docs/stacks.es.md`, and the message texts in English and Spanish.
- Tests for each change; the message catalog test of both languages must keep passing.
- Release: `.claude-plugin/plugin.json`, template stamps and pins, `CHANGELOG.md`.
- No change to the push per checkpoint, to the retry planner's rules, or to flows that work today.
