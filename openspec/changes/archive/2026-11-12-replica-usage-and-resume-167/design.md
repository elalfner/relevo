# Design

## Context

Observed on the current code, with the real scripts on a throwaway repository: a replicated `tasks.md` (section 1 template, section 2 docs, section 3 two replicas) gives four groups on the first run, so the checkpoints are `1/4` and `2/4`. After a cut, sections 1 and 2 are checked, `task-groups.mjs` lists only the two replica groups, and `replica-plan.mjs template --k 1 --of 2` exits 1 ("no commit `wip: checkpoint 1/2`"). With the first run's numbers (`--k 1 --of 4`) it finds the files. The new checkpoints of the resumed run are also numbered `1/2`, `2/2`, so a number can repeat in one branch. The group number is not a stable name for a template.

The usage reader (`lib/run-usage.mjs`) already reads each subagent from the `Agent` calls and `task_started` / `task_notification` events: `subagent_type`, `model`, `effort`, turns, seconds and an estimated cost. A replica launch is a `relevo:dev` launch like any other, so nothing in the log tells it apart today.

## Decisions

**D1. The checkpoint names its tasks (a trailer), the template is found by section.** `checkpoint.mjs` takes an optional `--tasks 1.1,1.2` (the tasks of the group, which `task-groups.mjs` prints) and writes `Relevo-Tasks: 1.1, 1.2` next to the `Issue-hash` trailer. `replica-plan.mjs template --section K --issue N [--base B]` takes the checkpoints of the issue whose trailer names a task `K.<n>` and prints their files, as it does today. The existing `--k/--of` form stays for a caller that has the numbers. Alternatives rejected: renumbering by looking at `tasks.md` (the numbers still repeat); finding the commit by the checked boxes in its diff (depends on what the developer edited, and is not an explicit marker). A trailer is explicit, goes through the same safe commit, and cannot be written by a person without a commit on the branch, which the resume check already refuses.

**D2. No marker, no guess.** A checkpoint made before this change, or a group that changed no file, has no marker: the command exits 1 as it does now, and the skill still has the developer read `git log`. Tasks that are not `\d+.\d+` are dropped, so the trailer cannot carry free text. The trailer does not change `isOwnCommit` or the resume check (they read the subject and `Issue-hash` only), and the hash trailer is still read correctly beside it.

**D3. A replica launch has a name.** `go` launches each replica with the Agent `description` `replica <task id>` (and the same for the fix launch of that target). The usage reader takes a call whose `description` matches `^replica <id>$` as a replica launch of target `<id>`. A name the skill gives is explicit; the mode word in the prompt text is not read.

**D4. Replicas are listed apart, not twice.** Replica launches leave `usage.agents` and go to `usage.replicas`: one entry per target with `id`, `model` (that of the last launch, which is the one that finished the target), `attempts` (launches), `turns`, `seconds` and `cost` (the estimated costs added, left out when any launch has none). `usageLine` writes one phrase after the agents ("Replicas: 3.1 haiku, 1 attempt, 12 turns, about $0.04; ... In total about $0.09; the rest of the run about $1.20.") and the marker carries `replicas`. The total of the replicas and the rest are written only when every cost is there. The digest reads totals only, so it is unchanged. Without a replica launch nothing is written.

**D5. Texts.** The phrases are added to `USAGE_TEXT` in English and Spanish; `tests/messages-language.test.mjs` covers them.

## Risks

- The skill must pass `--tasks` and the launch description; an agent that forgets leaves a checkpoint with no marker (the `git log` fallback) or a replica listed among the agents (today's behaviour). Both degrade to what exists. The skill text says it in the same sentence as the checkpoint command, and a test checks the skill names the flags.
- The marker's size grows by a few dozen bytes per replica.

## Not verified here

A real replicated build in the cloud and a real resume. The cause is shown with git history and the real scripts; whether the agent follows the new skill text is not.
