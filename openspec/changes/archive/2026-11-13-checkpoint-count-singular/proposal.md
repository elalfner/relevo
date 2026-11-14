# Proposal

## Why

Found in a real run of `relevo-sandbox` while checking #176 in Spanish (issue #148, run 43367133488): the comment of a run cut after one checkpoint said "reanudar desde el último checkpoint (1 guardados)". The count is written with a fixed plural, so a single checkpoint reads "1 guardados" instead of "1 guardado". English is not affected: "(1 saved)" has no plural. Part of #167 and #115; cosmetic, no guard changes (C2).

## What Changes

- The number of checkpoints in the comment of a cut run agrees in number with the word that follows it in Spanish: "(1 guardado)", "(2 guardados)". English keeps "(N saved)".
- Nothing else in the comment changes, and no other message has the same fixed plural: the only other count of this kind, "(N de M tareas hechas)", reads correctly for one.
- The text stays in the catalog, in English and Spanish, with the language test.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `go`: the checkpoint count in the comment of a run cut by the runner is written in the correct number.

## Impact

`scripts/lib/messages.mjs` (the `resume` wording of `run_no_outcome`), `tests/messages.test.mjs`, `tests/messages-language.test.mjs`, `CHANGELOG.md` (unreleased). Not touched: workflow templates, the version, the count itself (`rescue-work.mjs`).
