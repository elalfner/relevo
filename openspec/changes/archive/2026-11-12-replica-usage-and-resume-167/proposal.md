# Proposal

## Why

Issue #167 lists two follow-ups of guided replication (#135). The usage comment does not show the replicas apart from the rest of the run, so the saving of replicating cannot be read from it. And a replicated build that is interrupted and resumed cannot find its template checkpoint: `checkpoint.mjs` names a checkpoint `k/n` by the number of the group, but on resume `task-groups.mjs` lists only the pending groups and numbers them again, so `replica-plan.mjs template --k --of` looks for a commit that does not exist. This was reproduced on the current code (first run of four groups, interrupted after two: the resumed run has two groups and `template --k 1 --of 2` exits 1, while the commit is `wip: checkpoint 1/4`). It is a real defect, not a doubt.

## What Changes

- The checkpoint records the tasks it covers as a trailer (`Relevo-Tasks: 1.1, 1.2`), and `replica-plan.mjs template --section K --issue N` finds the checkpoint of section K by that marker, never by the number of the group. The skill gives the tasks of the group to the checkpoint and asks for the template by section. A checkpoint made before this change has no marker and is not found, as today: the skill's `git log` fallback stays.
- `go` names the launch of a replica (`replica <task id>`), the usage reader recognises it, and when replicas ran the usage comment and the marker list them apart from the other agents: per target the model, attempts, turns and an estimated cost, and the cost of the replicas against the rest of the run. Nothing is written when no replica ran.
- The new phrases are in the message catalog in English and Spanish, covered by the language test. `CHANGELOG.md` gets one entry under Unreleased. The version is not bumped.

Not changed (C2 of #115): the replica checkpoint, protected paths, the credential scan and the budget guard. The trailer goes through the same safe commit. Out of scope: overage in the quota phrase, per-target attribution of QA rejections, a rename script, a pattern from another repository.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: the checkpoint carries the tasks it covers, and the template of a replicated build is found by section, so a resumed run finds it.
- `execution-modes`: the usage comment and marker show the replicas apart from the rest of the run.

## Impact

`scripts/checkpoint.mjs`, `scripts/replica-plan.mjs`, `scripts/lib/rescue-work.mjs`, `scripts/lib/wip-commit.mjs`, `scripts/lib/run-usage.mjs`, `scripts/lib/messages.mjs`, `skills/go/SKILL.md`, the docs that name the template lookup, `CHANGELOG.md`, and their tests. No workflow file, no configuration key, no new dependency.
