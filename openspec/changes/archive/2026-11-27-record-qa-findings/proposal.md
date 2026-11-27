# Proposal

## Why

Nobody can say what QA is worth. The reviewers' findings are decided in a script on every attempt and then thrown away: a build that passes says only "QA passed", and nothing says what was corrected on the way. Nothing says either whether a correction a person asked for later was a defect that QA missed.

## What Changes

- `go` and `fix` keep, for each attempt, what the gate and the reviewers blocked and how many notes they left.
- The comment that ends the run carries that record in a hidden marker. Its visible text does not change.
- `fix` says what kind of correction it made: a defect, a gap in the specification, a change of mind, an integration or the completion of unfinished work. It is visible in its comment.
- A new `relevo qa-report` adds the records of a repository up: what QA stopped before a person saw it, and what the person had to correct.
- The daily digest gets one line from the same records.

No setting is added, and recording never changes the result of a run.

## Capabilities

### New Capabilities

- `qa-record`: what QA found on each attempt and what a person corrected afterwards, where it is kept and how it is added up.

### Modified Capabilities

- `status`: the daily digest gains a line about what QA stopped.

## Impact

- `scripts/qa-aggregate.mjs`, `scripts/validation-gate.mjs`, `scripts/render-message.mjs`, `scripts/lib/messages.mjs`, `scripts/cli.mjs`, `scripts/digest.mjs`, `scripts/lib/status-data.mjs`, `scripts/lib/status.mjs`, new `scripts/lib/qa-record.mjs`.
- `skills/go`, `skills/go/references/qa-run.md`, `skills/fix`.
- `docs/commands.md`, `docs/security.md` and their Spanish pages, `CHANGELOG.md`.
- Cloud builds of a project record only after its workflows pin a released version that has this change.
- Out of scope: the QA that `review` runs, runs cut before their comment, files projects in the report, and rebuilding past runs.
