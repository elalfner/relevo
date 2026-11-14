# Design

## Where the number comes from

The rescue step already runs `rescue-work.mjs`, which has the decision (`branch`, `base`, `issue`) and a `git` function, and prints one JSON line that `--github-output` also writes as `state=`, `branch=`, `detail=`. The count belongs there: after the commit and push, `git log origin/<base>..<branch>` is listed and the subjects that `isCheckpoint(subject, issue)` accepts are counted. That is the same predicate `resume-check.mjs` uses, so the comment and the next run agree on what a checkpoint is. The result gains `checkpoints` (a number) and the output file gains `checkpoints=`.

## Unknown is not zero

The renderer treats `0` as "no checkpoint was saved yet" and an absent value as "unknown". The script therefore writes `checkpoints=` only when it counted. It writes nothing when the decision has no base, git fails, or the work is on a `rescue/` branch (the comment does not use the number there). The workflow passes the value through unchanged, and the renderer's `present()` check keeps an empty string absent. The risk to avoid: `Number('')` is `0`, which would turn "unknown" into a false "no checkpoint was saved yet". The workflow therefore builds the key only when the value is not empty.

## Workflow edit

Two additions in `relevo-go.yml`, in the step "Report a run that ended without an outcome": `RESCUE_CHECKPOINTS: ${{ steps.rescue.outputs.checkpoints }}` in `env`, and the `checkpoints` key in the JSON given to `render-message.mjs`, set only when non-empty. The fallback English text that stays in the workflow is not changed. A verification session in `relevo-sandbox` pins the templates; this edit is two lines so a re-pin is cheap, and it is called out in the PR.

## Alternatives not taken

Counting in the workflow with `git log | grep` would put logic in YAML that the tests do not run and would duplicate `isCheckpoint`. Reading `resume-check.mjs` output would need the issue hash, which the report step does not have.
