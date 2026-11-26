# Proposal

## Why

The new cover does not say that Relevo itself catches mistakes. The five QA agents appear as a count and a line inside a card, so a reader concludes that the tests and the person find everything.

## What Changes

- `README.md` and `README.es.md` get a section between the figures and the queue: the team of agents that examines the work, with a table of what each one hunts, the checks that run first and the fix-and-review-again loop.
- "No agent grades its own work" leaves the list of reasons, since the new section says it.
- The middle handoff card is shortened so that it does not repeat the list of agents.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documentation`: the cover shows what each QA agent looks for, without claiming more than each one does.

## Impact

`README.md`, `README.es.md`, `tests/cover.test.mjs`, `CHANGELOG.md`. No script, skill or agent changes. Out of scope: figures about findings, which depend on `record-qa-findings`.
