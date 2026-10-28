# Design

## Context

See proposal.md - Why. What shapes the approach:

- `scripts/run-usage.mjs` prints one sentence and the build job posts it with `gh issue comment "$ISSUE" --body "$line"`. The scripts come from the package pinned by `RELEVO_VERSION`, so a change in what the script prints reaches a project when it raises that pin, with no change in its workflow text.
- The digest is built in `digest.mjs` from `gatherStatus` (reads from GitHub, one injected client) and `buildStatus` / `renderDigest` (pure). It also accepts `--input state.json`, which never writes, and the tests use it.
- `renderDigest` returns nothing when no one waits and no alert applies, and the spec for that stays.
- The digest workflow already has `issues: write`, which includes reading comments.
- The digest is written with the language of `relevo.yml` through inline `es` ternaries, not through the message catalog.

## Goals / Non-Goals

**Goals:**
- Add the figures of a run in a form that does not depend on the wording of the sentence.
- Sum them in the digest at a cost of a few calls, whatever the number of issues.

**Non-Goals:**
- Recovering the figures of runs made before the marker, from the text of their comments.
- Showing the usage in `/relevo:status`: the spec change is for the digest, and status stays what it is.
- A per-issue or per-person breakdown, or a limit that stops runs by the sum.

## Decisions

### D1. The marker is a JSON object in a hidden HTML comment

The comment body becomes the sentence, a blank line and `<!-- relevo:usage {"turns":37,"cost":1.8234,"tokens":123000,"cached":0,"notional":false} -->`. A figure the log does not report is left out of the object, as it is left out of the sentence. `notional` is true with a subscription.

`scripts/run-usage.mjs` prints both and the workflow is not touched: it already posts whatever the script prints. A new `usageMarker(usage, { subscription })` in `scripts/lib/run-usage.mjs` builds it, next to `usageLine`, from the same `readUsage` result, so the sentence and the marker cannot disagree.

*Alternative: parse the sentence.* Rejected: it changes with the language and with any rewording. *Alternative: a file or a variable.* Rejected: nothing outside the repository and no new store.

### D2. One read of the repository's comments, not one per issue

The digest reads `GET repos/{repo}/issues/comments?since=<seven days ago>&per_page=100`, paged, which returns the comments of every issue and pull request of the repository, closed ones included, in a few calls however many issues exist. `since` filters by update time, so each comment's own `created_at` is checked against the window afterwards.

*Alternative: read the comments of each issue in the status data.* Rejected: it multiplies calls by the issues, and finished issues are not in `gatherStatus` at all.

### D3. Only comments of a bot with a valid marker count

A comment counts when its author has type `Bot` and its body holds exactly one marker whose JSON parses to an object with finite numbers. A person who types a marker in a comment does not change the totals, and a malformed marker is ignored. The figures are never inferred from the sentence.

### D4. The sum, and how a notional cost is said

`sumUsage(runs)` returns the number of runs and the sum of turns, cost and tokens over the runs that report each figure. The cost is the sum of what was reported. If every counted cost is notional the line says so; if only some are, it says how many ("2 of 5 runs notional"). The cached tokens are not added to the tokens, as in the sentence of a run.

### D5. The line is part of the report and of the digest, and the digest still stays silent

`gatherStatus` gains `usage` (the runs found, empty on none), and `buildStatus` passes it on. `renderDigest` appends one line after the alerts when there are runs. The early return for "no one waits and no alert" stays above it, so usage alone never posts a digest ("Nothing waiting but usage exists"). The wording follows the inline Spanish and English of `renderDigest`.

A failure to read the comments leaves `usage` empty and is logged to stderr; the digest is posted without the line, as it is today. It is not added to `unread`, which the digest does not print.

### D6. The window is seven days, fixed

It is a constant of the library, not a setting of `relevo.yml`: there is no demand for another value and a setting would have to be validated, documented and tested.

## Risks / Trade-offs

- [Runs before the change have no marker, so the first digests show less than was spent] → the docs say so, and the line appears only once a run has a marker; the window then fills in a week.
- [A busy repository has many comments in seven days] → pages of 100; a repository with thousands of comments is a handful of calls, within the limits of the token, and the read is once a day.
- [The sentence and the marker drift apart] → both come from one `readUsage` result and one test compares them.
- [A project keeps an old `RELEVO_VERSION`] → its runs have no marker until it raises the pin, which the digest line makes visible by its absence; the upgrade note in the changelog says it.
- [`since` is by update time, so an edited old comment appears] → the creation date is checked against the window.

## Migration Plan

- No workflow text changes. A project gets the marker in its next runs by raising `RELEVO_VERSION` in `relevo-go.yml` and `relevo-digest.yml` to the release that carries this change; the digest scripts come from the same pin.
- The `Unreleased` changelog entry says that runs made before the marker are not counted.
- Rollback is a release without the marker: the digest then shows no line, and the comments with a marker stay harmlessly on the issues.
