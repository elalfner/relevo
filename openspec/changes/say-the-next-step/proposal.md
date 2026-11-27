# Proposal

## Why

Relevo has one table of next steps, but the reports of `review`, `fix`, `init` and `ship` and several of its messages end without saying what comes next, and `draft` and `closed` have no row at all (#223). A person has to guess the next command. #224, #225 and #227 wait for this.

## What Changes

- The table gains entries for `draft` and `closed`, a local-delivery variant of `in-review`, a lost-runner variant of `building`, and one step for after `init`.
- The final reports of `review`, `fix`, `init` and `ship` take the next step from the table.
- Every message either carries the next step or says that nothing is to be done and why. Only the messages that lack it are reworded; a test classifies every kind as hand-off, wait or info.
- The lines that two workflows write without the message catalog (a lost runner, a ship that ended without an outcome) carry the next step too.
- The guide's table of the life of an issue has the new rows, and `GLOSSARY.md` gains four terms.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `issue-lifecycle`: the table covers every state and the two variants; every message and report ends with a next step or a reason to wait; a hand-off has a command only when there is one.

## Impact

- `scripts/lib/next-step.mjs`, `scripts/next-step.mjs`, `scripts/lib/messages.mjs`, `scripts/lib/plan.mjs`.
- `skills/review`, `skills/fix`, `skills/init`, `skills/ship`.
- `templates/workflows/relevo-go.yml`, `templates/workflows/relevo-ship.yml`; a project gets these lines when `/relevo:init` updates its workflows.
- `docs/guide.md`, `docs/guide.es.md`, `GLOSSARY.md`, `CHANGELOG.md` (under `[Unreleased]`).
- `record-qa-findings`, still open, also edits `messages.mjs` and `skills/fix`: the two are built one after the other.
- Out of scope: label descriptions, the README flow block, making every message kind read the table, and the release.
