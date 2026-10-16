## 1. `think` hands over instead of writing

- [x] 1.1 In `skills/think/SKILL.md`, stop writing `GLOSSARY.md` and `docs/adr/`: keep each settled term as name, definition and words to avoid, and each warranted decision record as title and text, in a "To document" part of the agreement (also written when empty)
- [x] 1.2 In the same skill, keep reading the glossary, calling out conflicting or vague terms and probing with scenarios; keep the "vocabulary only" rule for what is handed over; say at the hand-off that nothing was written to the repository
- [x] 1.3 Remove the lines that name the glossary and decision-record files as created or uncommitted; keep the agreement file that is written only on request
- [x] 1.4 Update `tests/skill-think.test.mjs` for the new behaviour (no file writes for glossary or records, the "To document" part, the hand-off message)

## 2. `create` puts it in the issue

- [x] 2.1 In `skills/create/SKILL.md`, read the "To document" part of the agreement and write the optional `## Documentation` section with the exact text, naming only `GLOSSARY.md` and `docs/adr/`; omit it when nothing is handed over; show it whole at approval
- [x] 2.2 Add the optional `Documentation` section to `templates/issue.md` (with the leftover-template-text rule in `scripts/lib/issue-check.mjs` still catching an unfilled one) and describe it in `docs/issue-format.md`
- [x] 2.3 Check that `check-issue.mjs` passes an issue with and without the section and does not count it as a scenario or an edge case; add the test
- [x] 2.4 Update `tests/skill-create.test.mjs` (the section is written from the agreement, only those two targets, a request for another file is declined)

## 3. `go` builds it and QA checks it

- [x] 3.1 In `skills/go/SKILL.md`, where the change specification is written from the issue, add a task for the `Documentation` section and tell the developer to write exactly that text: entries appended after the existing ones, each record as a new numbered file in `docs/adr/` (highest number plus one); no task when the section is absent
- [x] 3.2 In `agents/qa.md`, add the documentation check: added lines of `GLOSSARY.md` and `docs/adr/` equal the issue's text, no other line of those files changed, and any change to them without a `Documentation` section is rejected
- [x] 3.3 Update `tests/skill-go.test.mjs` and `tests/agents.test.mjs` for both

## 4. Close the loop

- [x] 4.1 Update the `/relevo:think` row of `README.md` (it no longer writes the glossary; the entries travel in the issue)
- [x] 4.2 Run the full suite and `openspec validate glossary-travels-with-the-issue`
- [x] 4.3 Try it on the sandbox with issue #5, which already carries a `Documentation` section: after the build, the pull request adds the two entries to `GLOSSARY.md` and changes nothing else, and QA passes (verified on 2026-10-15 on the branch `feature/5-show-the-build-number`: `GLOSSARY.md` +8 −0 with exactly the two entries, the section copied into `design.md`, a documentation task checked, QA passed; the pull request itself is opened later by `/relevo:review`)
- [x] 4.4 When `relevo-v1` is archived, reconcile the `think` requirements it replaces and convert this change's ADDED requirements to MODIFIED ones; follow the `create` to `issue` rename if `rename-create-to-issue` has landed (done on 2026-10-16: `relevo-v1` is archived, the `think` delta modifies two requirements and renames a third, and `create` and `go` stay ADDED because they only gain requirements; `rename-create-to-issue` has not landed, so nothing to follow yet)
