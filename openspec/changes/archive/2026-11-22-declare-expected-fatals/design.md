# Design

## Context

`ownExpected` in `scripts/lib/logaudit.mjs` excuses an `ERROR:` line whose message contains an entry of `review.expected_errors`, and refuses any line with `FATAL`, `PANIC`, a deadlock, out of memory or a 5xx status. The validator `expectedErrorProblem` in `scripts/lib/stack-profile.mjs` forbids entries that name those signals, so that a list can never hide a real failure. The declared audit (`DECLARED_RULES`) turns every `FATAL:` or `PANIC:` line into a `fatal` finding. The list travels from the repository's profile through `--expected-error` of `review-state.mjs init` into `state.expectedErrors`, and from there to `auditApi` and the report; `doctor` notes it, warns when it is ignored, and reports an invalid entry. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- A repository can declare the exact `FATAL:` messages its own test harness provokes, with the guarantees `expected_errors` already has.
- The list can never excuse a fatal the harness did not provoke, a `PANIC`, a deadlock, out of memory or a server error.

**Non-Goals:**
- Substring or pattern matching of a fatal, which would excuse far more than the harness provokes.
- Handling the `LOG:` lines that follow (`checkpoint starting: ...`): the audit does not flag them.
- Messages of a server that does not write English (`lc_messages`); an entry is compared as written.
- A way for the agent to propose an entry.

## Decisions

**1. A new key, not a relaxed `expected_errors`.** `review.expected_fatals` is a separate list. The rule that `expected_errors` can never name a fatal signal keeps its meaning, and a repository that reads its own profile sees at once which list excuses a fatal. *Alternative: let `expected_errors` accept a `FATAL` prefix.* It would turn the one rule that protects every other entry into one with exceptions.

**2. An entry is a whole message.** The audit takes the text after the first `FATAL:` of the line, trims it and collapses runs of whitespace, and compares it for equality with each entry, case included. `terminating autovacuum process due to administrator command` excuses exactly that line, and not `terminating connection due to administrator command` or the same message with more text. *Alternative: substring match, as `expected_errors` does.* A fatal's message names what went wrong, so a short entry such as `terminating` would excuse a real crash.

**3. The signals that stay out of reach.** `ownExpectedFatal(line, entries)` returns null for a line that is not a `FATAL:` line or that carries `PANIC:`, `deadlock detected`, `out of memory` or an HTTP status of 500 or above, using the same checks as `ownExpected`, so those lines go on to their finding. The validator refuses an entry that contains those words or an HTTP status of 500 or above (reusing the lists of `expectedErrorProblem`, without `fatal` and `error` themselves, since a fatal message may say "fatal"), and an entry that starts with `FATAL`, because the entry is the message after the level.

**4. The same flow as `expected_errors`.** The key goes in `REVIEW_KEYS`, the plugin's profiles may not carry it (the loop over `adapter`, `needs`, `expected_errors` gains it), it is dropped and listed as ignored on a stack that is not declared, `review-state.mjs init` takes `--expected-fatal <text>` (repeatable, only with `--declared`, validated with the same function), `newState` stores `expectedFatals`, and `audit` passes them to `auditApi`. In `auditApi` the check sits in the declared branch before the `PG_RULES` loop, so a listed fatal is excused before it can become a finding. It is excused only while a run is recorded, like `declaredExpected`; with no run it is a `fatal` finding, not a `denial`, because it is not a denial.

**5. The report and `doctor`.** The report gets its own paragraph with each entry and its count, after the expected errors, saying the entries are the repository's declaration of what its harness provokes and that a waiver stays the person's. `doctor` gets the three checks of `expected_errors` under its own ids: a note with the count, a warning when ignored, and an invalid profile for a bad entry.

## Risks / Trade-offs

- [A repository lists a fatal that hides a real fault with the same message] → the entry is the repository's declaration, listed with its count in the report and in the pull request, and a count that surprises the person is visible. It is not excused with no run recorded.
- [A Postgres upgrade rewords the message] → the line becomes a finding again and the person updates the entry; failing closed is the safe side.
- [A server that does not write English] → the entry must be written as the server writes it; not handled.
- [Two changes touch `logaudit.mjs` and `review-state.mjs`] → they modify different requirements and different lines; the second to be applied rebases on the first.

## Migration Plan

None: a repository that does not set the key sees no difference. Rollback is reverting the commit.
