# Tasks

## 1. Record the behaviour

- [x] 1.1 Write the delta `specs/status/spec.md` with the two requirements that state where the digest is posted and on which days. Verify with `openspec validate spec-the-digest-destination`.
- [x] 1.2 Check each scenario against `scripts/digest.mjs` and its tests: the weekend rule is covered by `tests/status.test.mjs`; the destination and the missing `digest.issue` are covered by no test and are read from the script.

## Workflow follow-up

- Run `npm test` and `openspec validate --all` before pushing, then archive the change.
