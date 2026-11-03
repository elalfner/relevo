## Context

`renderMessage('qa_failed', ...)` chooses the next-step reason at `scripts/lib/messages.mjs:452`: `values.recovery ?? (branch_state === 'kept' ? 'kept' : 'fix')`. The `qa-failed` entry of `scripts/lib/next-step.mjs` has the variants `fix`, `kept`, `toolchain` and `delete-branch`. `unsafe` and `not_pushed` leave no remote branch, yet reach `fix`.

## Goals / Non-Goals

**Goals:** stop recommending `/relevo:fix` when there is no branch; say how to get the issue built again with the labels that exist today.
**Non-Goals:** a rebuild without `ready` (change B), changing the scanner, saving unpushed work.

## Decisions

- New variant `rebuild` with `command: null` and who `assignee`, like `toolchain`: the action is label work, not a slash command. The line is built as `Your next step: <hint>.` by the existing branch for steps without command.
- The default in `messages.mjs` becomes: explicit `recovery`, else `kept` for `kept`, else `rebuild` for `unsafe` and `not_pushed`, else `fix`. An explicit `recovery` still wins, so `existing` is untouched.
- The hint tells the person to resolve the cause shown in the comment (file and line, or the changed text) before relabelling, because a rebuild of a scanner false positive would fail again.

## Risks / Trade-offs

- Relabelling `ready` starts the cloud run immediately; this is the current behaviour and change B addresses it.
- `not_pushed` also covers a branch that failed to push for network reasons; `rebuild` is still right because nothing is on the remote.

## Assumptions

- No other caller of `nextStep({state:'qa-failed'})` relies on `fix` as the default for `unsafe`; the table test requires only that each variant resolves.
