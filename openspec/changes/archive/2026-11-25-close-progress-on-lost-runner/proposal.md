# Proposal

## Why

The progress comment of a cloud build is closed by steps of the `build` job itself (`Stop the progress report` and `Close the progress comment`, both `if: always()`). Those steps cover a failure, a cancellation and a timeout of a step, but not a runner that stops talking to GitHub: with a self-hosted runner that is lost in the middle of a build, no step runs on it, the job ends as failed after its timeout, and the comment stays as "build in progress" with the last phase, the tasks and the minutes of the last edit. Nothing edits it later, so the issue shows a build that is running for as long as the issue exists, next to the later comments that say it stopped.

It was seen in a build whose runner lost its connection with the server about 38 minutes in, during QA with every task marked: the job ended as failed at its 60-minute limit and the comment kept "QA (attempt 1 of 2), tasks 6 of 6, 38 min" until a person found it days later.

## What Changes

- **The progress comment is also closed by a job that does not depend on the runner of the build.** When the `build` job ends as failed or cancelled, a step of a job that needs it (the `requeue` job already runs after it with `if: always()`, on its own runner and with no checkout, or a job of its own) closes the comment with the same one-line text that the normal close uses, saying that the run ended without a result and linking the run. It finds the comment by its marker, which is what `close` already does, and it does nothing when the comment is already closed or does not exist.
- **The close is safe to repeat.** The step that runs on the build runner and the step of the second job can both run; the comment ends closed whichever writes last, as `A closed progress comment is not edited again` already requires of the checks.

Not in this change: finding why a runner is lost (memory, CPU or network of the machine are not something the workflow can read); retrying a build whose runner was lost; any change to the content of the progress text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: the progress comment is closed when the run ends, including when the runner of the build is lost and none of its steps ran.

## Impact

- Code: `templates/workflows/relevo-go.yml` (a closing step in a job that needs `build`) and `scripts/progress.mjs` / `scripts/lib/progress.mjs` if the close must work without the progress folder that the runner of the build keeps; the test that compares the template with the scripts.
- Content: `docs/execution.md` in both languages, one line.
- Cost: one short step per build that ends as failed or cancelled; none for a build that ends normally.
- Order: independent of `go-visibility`, which also touches the progress comment; the later one rebases.
