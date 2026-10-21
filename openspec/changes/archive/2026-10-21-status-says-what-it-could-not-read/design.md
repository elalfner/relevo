# Design

## Context

`gatherStatus` of `scripts/lib/status-data.mjs` makes GET calls through an injected client. Three of them are wrapped so that a failure is swallowed: the comparison of a pull request's head with its base (`behind` becomes 0), the go workflow file (`readCloudBuilds` returns true, "the cautious answer"), and the repository variable that pauses the cloud (`variable` becomes null). The reads of linked repositories already produce `unreadable` entries that the report prints. `buildStatus` and `renderStatus` of `scripts/lib/status.mjs` build and print the report; the JSON output is the report itself.

## Goals / Non-Goals

**Goals:**
- A failed read is visible, with its reason and what it affects.
- The answer "nothing waits" is never stated flatly when part of the data is missing.

**Non-Goals:**
- Retrying, caching or changing which reads status makes.
- Failing the command: a partial report is more useful than none, and the exit code stays 0.

## Decisions

- **`unread` is a list of `{ what, reason, affects }`.** `what` is one of `compare` (with the pull request), `workflow` and `variable`; `reason` is the first line of the error; `affects` is a key that the renderer turns into a sentence in each language. The list lives in the data, so the JSON carries it and the report prints it.
- **A not-found on the workflow is an answer.** Only other errors are recorded for it, as now it returns true for them. For the variable, a 404 means the variable does not exist and is not an error; other errors are recorded.
- **The cautious answers stay.** When the workflow cannot be read the report still assumes the cloud builds; the new line says so.
- **Wording.** "Could not read: the variable RELEVO_CLOUD_GO (HTTP 403). The list of issues you could build by hand may be incomplete." One line per read. The empty case appends "(from what could be read)".
- **The digest ignores it.** It posts only when something waits; adding a note there is a separate decision.

## Risks / Trade-offs

- A cloud session that cannot read Actions will always show the lines; they are true, and a person there learns what is missing instead of a wrong answer.
- Matching a 404 by text is how the code already does it; a test pins it.
