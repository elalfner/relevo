# Design

## Context

The usage comment already lists the replicas apart (`run-usage.mjs`, from the launches that `go` names `replica <task id>` in the execution log). The model of a replica is chosen by `replica-plan.mjs model`, which prints `{ model, escalate, why }`; only the `model` reaches the launch, and the `why` is lost. The plan of the other roles is kept by `model-plan.mjs` in `model-plan.json` of `$RELEVO_PROGRESS_DIR`, and `run-usage.mjs` reads it from `--progress-dir`. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- The comment and the marker say why each replica ran on its model.
- Nothing changes for a run that recorded no reasons.

**Non-Goals:**
- Translating the reasons, or changing how the model of a replica is chosen.
- Reading the reason from the execution log (the output of a script in a tool result): it is not tied to the launch that used it.

## Decisions

- **Record it where the model is chosen, like `model-plan.json`.** `replica-plan.mjs model --task <id>` appends `{ task, model, failures, why }` to `replica-models.json` in `$RELEVO_PROGRESS_DIR`. The file is outside the working tree, so it cannot be committed; writing it never fails the run (the script exits 0 always, as today). Alternative: parse the tool results of the execution log and match each `replica-plan.mjs model` result to the launch that follows. Rejected: it depends on the order of the log and on how the runner prints tool results, and it ties the report to text that was not meant as data.
- **The reason of the last launch.** A target launched twice (a failure of the gate) has two records. The comment shows the last one, because it explains the model that built the target. The earlier ones stay in the file.
- **Match by task id.** The launch description `replica <task id>` and the `--task <id>` of the command carry the same id (`2.1`). A record whose id has no replica in the log is ignored, and a replica with no record is listed without a reason.
- **The words are in the catalog, the reason is quoted.** One phrase per language in `messages.mjs` (`, because {{why}}` and `, porque {{why}}`). The reasons are English sentences written by `replica-plan.mjs`, quoted like the notes of the plan; translating them would put a second catalog in the script.
- **The marker gets `why` per replica, nothing else.** The digest reads the totals and ignores `replicas`, as it does today.
- **The skill passes the id.** Step 3 of a replicated build in `skills/go/SKILL.md` adds `--task <task id>` to the command. A skill without it records nothing and the comment is as before.

## Risks / Trade-offs

- The reason is only as good as the sentence of the script: `the developer is not on auto, so the repository decided its model` is clear, the others are shorter.
- A progress folder that is full or unwritable leaves the replicas without a reason; the comment is never worse than today.
