# Tasks

## 1. The reproducing test, failing first

- [ ] 1.1 Add to `tests/qa-aggregate.test.mjs` the case of issue #150 (attempt 1: `spec` asks to read the question from a constant; attempt 2: `spec` passes and `code` rejects the assertions on it), the no-contradiction case and the same-lens-repetition case; run them on the unchanged code and show the contradiction test failing.

## 2. The check in the aggregation

- [ ] 2.1 Add the anchors, the comparison of D2 and the `contradiction` output to `scripts/lib/qa-aggregate.mjs`, and `--previous` to `scripts/qa-aggregate.mjs`; verify the tests of 1.1 pass.
- [ ] 2.2 Add tests for the guards: a `security` finding or a verified hard rule blocks (no contradiction); another blocking finding exists; a path-only overlap; missing or invalid previous reports; the CLI prints `contradiction` and keeps exit 1.

## 3. The comment and the skill

- [ ] 3.1 Add the contradiction line to `qa_failed` in `scripts/lib/messages.mjs`, in English and Spanish, and verify `tests/messages.test.mjs` and `tests/messages-language.test.mjs` pass.
- [ ] 3.2 Update step 4 and step 5 of `skills/go/references/qa-run.md`, and the reason in the failure path of `skills/go/SKILL.md` and `skills/fix/SKILL.md`; verify `tests/skill-go.test.mjs` and `tests/skill-fix.test.mjs` pass.
- [ ] 3.3 Add the CHANGELOG entry under Unreleased (no version bump) and run `openspec validate --all` and `npm test`.
