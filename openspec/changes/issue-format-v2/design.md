## Context

See `proposal.md`. Facts that shape the design:

- The builder does not read the issue: `go` writes OpenSpec artifacts from it and `dev` and `qa` read those. So anything that must reach the builder has to be copied into `design.md` (or the specs, or `tasks.md`) by `go`.
- The skills are prose; the rules that must not vary are in scripts with tests. Copying text is such a rule: a model that copies paraphrases.
- `grill-with-docs` is published for the person only, and `think` may not regain control when it ends, so whatever must survive has to be written before it is launched.
- GitHub limits an issue body to 65,536 characters; the study of issues for agents, known only by its summary, suggests shorter and well delimited issues merge more often, which is why the length is a warning and the new sections are optional.

## Goals / Non-Goals

**Goals:** a place in the issue for decisions, constraints, pointers, verification and assumptions; a word for word path from the issue to `design.md`; a check that no id of the agreement is lost; a build that does not start with open questions; `qa` that applies decisions.

**Non-Goals:** the `Design reference` section and `design-fetch.mjs` (a follow-up: it needs a real test of the token against private attachments); passing the session transcript; per-stack questions for `issue` (they come with the Laravel profile); showing the reason of each `needs-spec` in `status`; translating the format page.

## Decisions

**D1. Sections by heading, in a library.** `scripts/lib/issue-sections.mjs` exports `sections(body)` returning an ordered list of `{ name, level, text }` for the headings of level 2 (`## `), ignoring headings inside fenced code, and `copyBlock(body, names)` returning the markdown that `go` appends: for each requested name that exists, `## From the issue: <Name>` and the text unchanged, in the order of `names`. The names are the English headings of the format; the match ignores case. `scripts/issue-sections.mjs --body-file f [--copy "A,B"] [--list] [--section Name]` prints the block, the names present, or one section.

**D2. Ids are checked, not interpreted.** In `Decisions` an id is a heading `### D<number>. <title>`, in `Constraints` a bullet starting `C<number>:`. The check fails on a repeated id or on a heading that starts like an id but is malformed (`### D. x`). Fields `Decided`, `Why` and `Discarded` are asked by the skill and shown by the template, not required by the check, because a short decision may not have a discarded alternative.

**D3. Open questions.** `parseIssueBody` returns `openQuestions` (the non-empty bullet and paragraph lines of the section, excluding the placeholder text of the template and the words "none" or "ninguna" alone) and `needsClarification` (the literal text, outside code blocks). `check-issue` fails on either. In `plan.mjs` the same fields turn a `start` into the `needs-spec` decision with `reason: 'ambiguous'`, naming the first question; the existing `reason: 'missing'` stays for the other causes.

**D4. Length is a warning.** `checkIssueDraft` returns `warnings` (the body over 8,000 characters); `check-issue.mjs` prints them and its exit code ignores them.

**D5. The coverage check.** `scripts/issue-coverage.mjs --agreement <file> --issue <file> [--issue <file> ...] [--discarded D3,Q1]` takes the ids from the agreement (any `D`, `C`, `A`, `Q` followed by digits at the start of a line or after a bullet), looks for each one in the drafts and prints a table: id, the issue file, the section. An id found nowhere and not in `--discarded` makes the exit code 1 and is listed as without destination. The id found in `Open questions` counts as found (the check of D3 stops the build). This checks presence, not meaning; the person approves the table.

**D6. `think` writes first.** The skill text changes in three places: before asking for `/grill-with-docs` it writes "Settled so far" with ids; `$ARGUMENTS` may be `#n` (reading with `gh issue view <n> --json title,body,labels` and `gh issue view <n> --comments` limited to the last `needs-spec` comment, both read-only); and in a long session it offers to save the file. The closed list of OpenSpec commands for `think` is added to `scripts/lib/openspec-commands.mjs` (`think: ['list', 'show', 'status']`) and the test that compares the table with the skill text covers it.

**D7. The reason in the comment.** `needs_spec` already carries a `reason`; the next-step line (`next-step.mjs`) already differs by it. This change makes sure the skill `go` passes `ambiguous` for open questions and that the line for `ambiguous` names `/relevo:think #<n>`; the text is checked by the messages test in both languages.

**D8. The offer of `ready`.** After the creation step, one question, apart from the approval of the drafts. On yes, `issue` applies `ready` with `label-change.mjs --to ready --current "<labels>"` (and, for an updated `needs-spec` issue, the same script removes `needs-spec`). Permission is read with `gh api repos/{owner}/{repo} --jq .permissions` (push, maintain or admin; with `trust: public` maintain or admin). If it cannot be read, the skill assumes no permission and says so.

**D9. Duplicates.** `gh issue list --state open --search "<words of the title>" --json number,title,labels --limit 10`, shown before the draft. The model decides what is similar; a script would only repeat the search.

**D10. Update mode moves to a reference file.** `skills/issue/references/update.md` holds the update flow; `SKILL.md` keeps the mode line and a one-line pointer (`Read ${CLAUDE_PLUGIN_ROOT}/skills/issue/references/update.md`). Tests for the skill read both files.

**D11. The brief.** `scripts/lib/review-brief.mjs` exports `reviewBrief({ issue, specs, scenarios })`: the title, up to two sentences of the `Summary` section, the first line of `Outcome`, the risk line copied from the `built` comment when present, and the count of scenarios and edge cases. `scripts/review-brief.mjs --issue-file f --change-dir d` prints it. The caps (two sentences, 160 characters per line) are constants with tests.

**D12. QA reads the ids.** `agents/qa.md` gets a section "Decisions and constraints from the issue": for every `D` and `C` under the headings `From the issue: Decisions` and `From the issue: Constraints` in `design.md`, check the diff and cite the id when it is broken; compare each copied section with the issue text given by the orchestrator (the `go` skill passes the sections it copied, from `issue-sections.mjs`). `dev` is told to treat those sections as binding and to report a conflict as an open question.

## Risks / Trade-offs

- A longer template can lead to longer issues; every new section is optional and the skill asks only for what the agreement settled.
- The coverage check is presence only; a paraphrase passes it. The table shown to the person is the control for meaning.
- Splitting `Design reference` out leaves front work without a way to receive pictures for now; it is announced in the changelog.
