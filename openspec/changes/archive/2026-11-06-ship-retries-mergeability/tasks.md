## 1. Retry the transient mergeability state

- [x] 1.1 In `check()` of `scripts/lib/ship-unattended.mjs`, wait and reload while `mergeable` is not `MERGEABLE` or `CONFLICTING`, with the `mergeableTries` and `mergeablePollMs` context options; stop with a reason that says the state never settled when the tries run out.
- [x] 1.2 Tests in `tests/ship-unattended.test.mjs`: unknown then mergeable merges and keeps the label meanwhile; never computed stops, removes the label and says it never settled; conflicting does not wait.

## 2. Record which checks were relied on

- [x] 2.1 Add `checksOid` to the summary of `shipDecision` in `scripts/lib/ship.mjs`, and build the note of the final comment in `scripts/lib/ship-unattended.mjs` (English and Spanish) from it for the three cases: own checks, carried over, none.
- [x] 2.2 Tests in `tests/ship.test.mjs` and `tests/ship-unattended.test.mjs` for the three cases; adjust the assertions that match the old wording.

## 3. Skill, workflow header, docs

- [x] 3.1 In `skills/ship/SKILL.md`, tell the agent to rerun `ship-check` a few times when the only reason is the mergeability one, and to report the commit whose checks it relied on; extend `tests/skill-ship.test.mjs`.
- [x] 3.2 Update the comment block of `templates/workflows/relevo-ship.yml` (comments only, no version change) and `tests/workflow-ship.test.mjs`; update `docs/execution.md` where it describes the checks note.

## 4. Changelog and verification

- [x] 4.1 Add one entry under `[Unreleased]` in `CHANGELOG.md`; do not touch `.claude-plugin/plugin.json`.
- [x] 4.2 Run `npm test` and `openspec validate ship-retries-mergeability`; report any failure.
