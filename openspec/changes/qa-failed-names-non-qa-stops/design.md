# Design

## One list of QA rejections, everything else is a stop

`qa_failed` today decides the wording by exceptions: a limit, one policy stop, or no retries; everything else is "QA still rejected it". The list of exceptions is the wrong way round, because a new reason is described as a QA rejection until someone remembers to add it. The change inverts it: a short list of the reasons that are a QA rejection (`QA rejected after the retries`, `QA rejected: nothing the developer agent can fix`) keeps the QA wording, and any other non-empty reason is a stop for that reason. A comment with no reason keeps the QA wording, so callers that never passed one do not change.

## Wording

Non-QA stop, English: title `#N "title" stopped ❌`; "What happened: The run stopped (<reason>). QA did not reject the work." Spanish: `... se detuvo ❌`; "La ejecución se detuvo (<motivo>). QA no rechazó el trabajo." The reason is shown as the skill names it, in English, as the other messages already do (`reason_suffix`).

"QA did not reject the work" is true for every reason on the list: for the checks before the build, the specification, the branch and the guard QA did not run, and for `lens report invalid`, `automated validation could not run` and `automated validation failed after the retries` QA (or its gate) did not reach a verdict that rejects the work. The comment does not claim that QA never ran.

## The title is a marker that `fix` reads

The title is a line of the catalog, but it is also how `/relevo:fix` finds the failure comment: `scripts/lib/failure-comment.mjs` looks for the last comment whose first line matches `#N "title" (failed QA|no pasó QA) ❌` and reads its `Finding:` line. The usage-limit stop kept `failed QA ❌` for that reason (its test says "the heading is the one that fix reads"). Changing the title in the catalog alone would make `fix` miss the comment of every stop that points to it, such as `branch already exists` (next step `/relevo:fix`).

So both change together: the title becomes a computed phrase (`{{headline}}`, set in `renderMessage` like `happened`) that is `failed QA ❌` / `no pasó QA ❌` for the QA rejections and the no-reason comment, and `stopped ❌` / `se detuvo ❌` for any other reason; and the heading `fix` looks for accepts those two as well. The old titles still match, because the comments already posted on issues keep them. The limit stop is covered by the same rule as any other non-QA reason and so also changes its title; its body and next step are unchanged.

## Reasons that already have their own text

`run limit reached` and `protected path in the diff` are checked first, as today, so their wording and their next step do not change. `POLICY_STOPS` stays the place where a reason gets text of its own.

## Alternatives not taken

Adding one entry to `POLICY_STOPS` per reason would give each a precise sentence, but it repeats the mistake: the next reason added to the skill falls back to the QA wording. A generic stop wording with the reason in it is accurate for all of them, and an entry can still be added later where a sentence of its own helps.

A test guards the pairing: every title that `renderMessage('qa_failed', ...)` can produce, for each kind of reason, in both languages, must be found by `failureContext`, so a title cannot change again without the reader.
