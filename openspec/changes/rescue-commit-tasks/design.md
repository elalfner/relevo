# Design

## Context

`rescueWork` already writes a `Relevo-Tasks:` trailer when it is given `tasks` (a checkpoint gets them from `--tasks`, from the skill). The rescue step of the workflow runs `rescue-work.mjs` with only the decision, so the limit commit gets none. The decision names the change (`change`), whose `tasks.md` is in the working tree with the boxes that the developer checked. The lookup by section (`replica-plan.mjs template --section K`) keeps only commits that are checkpoints. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- The limit commit says which tasks it holds, without the skill or the agent doing anything.
- A template left in a limit commit can be found by section.

**Non-Goals:**
- Changing the QA-rejection commit, the count of checkpoints, or the resume check.

## Decisions

- **Derive the tasks from `tasks.md`, in the rescue.** The tasks are the ones checked `[x]` in `openspec/changes/<change>/tasks.md` of the working tree, minus those that a `Relevo-Tasks:` trailer of a commit over the base already names (checkpoints and earlier limit commits). Alternative: have the agent pass the tasks, as it does for a checkpoint. Rejected: a run is cut when the agent cannot act, so the rescue has to work from what is on disk.
- **Only when nothing was given.** An explicit `tasks` (a checkpoint) wins and is not derived, so checkpoints do not change.
- **Never worse than before.** A missing or unreadable `tasks.md`, a decision without a change, a git error: no trailer and no failure; the commit and the push are as they are today. The ids go through `cleanTaskIds`, so only numbers like `2.1` reach the message.
- **A new reader of the checked tasks** next to `taskGroups` in `task-groups.mjs` (it reads the pending ones): `doneTaskIds(text)` returns the ids of `- [x] N.M` lines, in order.
- **The lookup by section accepts the limit commit.** In `replica-plan.mjs template --section K`, a commit whose subject is `wip: stopped by limit (#N)` and whose trailer names a task of section K counts like a checkpoint. The lookup by `--k --of` stays on checkpoints. The count of checkpoints and the resume check do not change: a limit commit is still not a checkpoint.
- **A task checked and finished in the limit commit but not in `tasks.md`** (the agent did the work and did not check the box) is not named. That is the same information that the resume uses to know what is pending.

## Risks / Trade-offs

- The trailer lists what the boxes say, not what the diff holds: a box checked by the agent for work that is not in the commit would be named. The lookup by section returns the files of that commit, so it can be wrong in that case. It is no worse than the checkpoints, whose tasks the agent also reports.
- A branch with limit commits made before this change has no trailer: the lookup finds nothing there, as today.
