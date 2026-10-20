# Tasks

## 1. Reading and checking the format

- [x] 1.1 Add `scripts/lib/issue-sections.mjs` (`sections`, `copyBlock`) and `scripts/issue-sections.mjs` (`--body-file`, `--list`, `--section`, `--copy`). Verify with `tests/issue-sections.test.mjs`: headings inside fenced code ignored, order of `--copy`, case-insensitive names, an absent section skipped, text copied byte for byte (including a table and a code block), empty input.
- [x] 1.2 Extend `parseIssueBody` with `openQuestions` and `needsClarification`, and `checkIssueDraft` with the id checks, the open-question and `NEEDS CLARIFICATION` problems, the new template placeholders and `warnings` for a body over 8,000 characters; print the warnings in `scripts/check-issue.mjs` without changing its exit code. Verify with additions to `tests/issue-check.test.mjs` and `tests/issue-parse.test.mjs`: every scenario of the `issue` delta about the format, open questions, repeated ids and length, and the earlier issues of the tests still passing.
- [x] 1.3 Turn open questions into the `needs-spec` decision with `reason: 'ambiguous'` in `scripts/lib/plan.mjs`, naming the question, and make the `ambiguous` next-step line name `/relevo:think #<n>` in `scripts/lib/next-step.mjs` and `messages.mjs`, in both languages. Verify with additions to `tests/plan.test.mjs`, `tests/next-step.test.mjs` and `tests/messages.test.mjs`: a ready issue with a question becomes `needs-spec` ambiguous, one without stays as it was, the line in English and Spanish.

## 2. Nothing is lost on the way

- [x] 2.1 Add `scripts/lib/issue-coverage.mjs` and `scripts/issue-coverage.mjs` (`--agreement`, repeated `--issue`, `--discarded`; a table and exit 1 for ids without destination). Verify with `tests/issue-coverage.test.mjs`: an id in a decision, in a constraint, in open questions, one nowhere, one discarded, two issues, ids that only look similar (`D10` against `D1`).
- [x] 2.2 Add `review-brief` (`scripts/lib/review-brief.mjs`, `scripts/review-brief.mjs`). Verify with `tests/review-brief.test.mjs`: the caps, a long summary cut at two sentences, a missing outcome, the risk line taken from a `built` comment, the count of scenarios and edge cases.

## 3. The skills and agents

- [x] 3.1 Rewrite `templates/issue.md` and `docs/issue-format.md` for the new sections, `Related:` and the ids. Verify with `tests/template.test.mjs` and a new case in `tests/issue-check.test.mjs`: the template with its placeholders filled passes, the template unchanged fails, and every heading the docs name is one the scripts know.
- [x] 3.2 Update `skills/issue/SKILL.md` (the new questions, the coverage table, duplicates, the separate offer of `ready`, the read of OpenSpec specs) and move the update mode to `skills/issue/references/update.md`; add `think: ['list', 'show', 'status']` to `scripts/lib/openspec-commands.mjs`. Verify with `tests/skill-issue.test.mjs` and `tests/openspec-commands.test.mjs`: each script the skill names exists, the offer of `ready` comes after the creation and uses `label-change.mjs`, the update flow is in the reference file and still names `can-edit-issue.mjs`, the update flow is no longer in SKILL.md (it moved to the reference file, so a creation does not load it), and the OpenSpec commands of the skill are on the table.
- [x] 3.3 Update `skills/think/SKILL.md` (settled-so-far list with ids before the grill, `#n`, saving the agreement, the closed command list). Verify with `tests/skill-think.test.mjs`: each scenario of the `think` delta has its sentence, the list comes before the request to run the reserved skill, and no command outside the table appears.
- [x] 3.4 Update `skills/go/SKILL.md` (copy the sections with `issue-sections.mjs --copy`, the open questions, passing the copied sections to `qa`), `agents/qa.md` (decisions and constraints by id, copied sections compared), `agents/dev.md` (the sections are binding) and `skills/review/SKILL.md` (the brief before the shot list). Verify with `tests/skill-go.test.mjs`, `tests/agents.test.mjs` and `tests/skill-review.test.mjs`: the scripts named exist and their flags are implemented, the copy comes before the developer, and QA cites ids.

## 4. Documentation and integration

- [x] 4.1 Update `docs/commands.md`, `docs/commands.es.md` and `CHANGELOG.md` (including that `Design reference` is a follow-up). Verify with `tests/readme-sync.test.mjs` and the changelog test.
- [x] 4.2 Run `node --test tests/*.test.mjs` and `openspec validate --all`; both must pass.
- [x] 4.3 Try it where it can be tried: run `check-issue` and `issue-sections` on the real issues of the sandbox, and draft two new v2 issues for the sandbox (one with an open question) to see the check and the `needs-spec` path; the cloud build of a v2 issue waits for the change to reach `main`. Record what happened, and what could not be tried, in `docs/pilot-findings.md`.
