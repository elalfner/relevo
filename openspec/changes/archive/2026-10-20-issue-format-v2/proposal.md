# Proposal

## Why

The issue is the only thing the builder sees: `go` turns it into OpenSpec artifacts and `dev` and `qa` read those, not the issue. Today the format carries scenarios, edge cases, out of scope, screens, a data contract and documentation. What `think` settles beyond that (a decision and why it was taken, a constraint such as a performance limit, a pointer to the code that matters, what only a person can verify on a device, an assumption the person approved) has no place to go, so it is dropped or reworded on the way. Facts read in the code:

- `parseIssueBody` and `check-issue` know `Summary`-less bodies: only scenarios, edge cases, `Depends-on`, `Allow-paths` and `Platform`. Nothing stops an issue with an unanswered question from being built: `go` can only guess.
- `go` copies one section (`Documentation`) word for word into `design.md`, by instruction in prose; `qa` checks only that one.
- `skills/think/SKILL.md` asks the person to run `grill-with-docs`, which is published for the person only, and `think` may not regain control when it ends; whatever the exploration found is not written down in a form `issue` can use before that.
- `think` accepts only an idea, and `needs-spec` issues have no direct way back into it.
- `issue` never offers `ready`, so the writer must remember to apply it, and its update mode (about 2.5 KB of a 13 KB skill) is loaded on every creation.
- `issue` does not look for an existing issue before showing a draft.
- The reviewer opens a built issue and finds a long comment; there is no short block saying what was asked and what to check first.

## What Changes

- **Issue format v2.** New optional sections `Outcome`, `Decisions` (`### D1.` with Decided, Why, Discarded), `Constraints` (`C1`), `Code pointers`, `Verification`, `Assumptions` and `Open questions`, and a `Related:` line. Headings stay in English; contents are in the language of the repository. Every issue that passes today still passes.
- **A script for sections.** `issue-sections.mjs` extracts sections by heading and prints the block that `go` appends to `design.md` ("From the issue: Decisions", and so on) word for word, so nothing is paraphrased.
- **Open questions block the build.** An `Open questions` section with content, or the text `NEEDS CLARIFICATION`, makes `check-issue` fail and sends an issue to `needs-spec` with the reason `ambiguous`.
- **`check-issue` also checks** that decision and constraint ids are unique and well formed, and warns (does not block) when the body is over about 8,000 characters.
- **`qa` applies what was decided.** A change that breaks a decision or a constraint of the issue is rejected citing its id; `qa` compares the copied sections with `design.md`.
- **Nothing is lost between `think` and `issue`.** `think` writes the agreement as a list with ids before asking for `grill-with-docs`; `issue` completes it with what the interview settles, assigns ids and shows a table of which id went to which section and which have no destination. A new script checks it; an item is dropped only when the person marks it as discarded.
- **`think #42`** reads a `needs-spec` issue (body and last comment, read-only) and starts from it; the `needs-spec` comment says whether the reason is `missing` (go straight to `/relevo:issue <n>`) or `ambiguous` (think first). In a long session `think` offers to save the agreement for a clean chat. Its OpenSpec commands are a closed read-only list.
- **`issue` improves.** A separate yes/no question offers `ready` for the created issues (and, for an updated `needs-spec` issue, swaps `needs-spec` for `ready`), never on its own and only when the person can write labels; it searches for similar open issues before showing a draft; it asks for the new sections; it reads specs with `openspec list --specs --json` and `openspec show <spec> --type spec` for the capabilities the issue touches; the update mode moves to `skills/issue/references/update.md`.
- **A short brief for the reviewer.** `review-brief.mjs` writes about six lines (what was asked, the outcome, what to check first) with fixed caps, and `review` shows it before the shot list.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `issue`: the format, the check, the coverage table, the offer of `ready`, duplicates, the update mode's labels.
- `think`: the agreement in two moments, `think #n`, saving the agreement, the closed commands.
- `go`: sections copied word for word, open questions, the reason `ambiguous`, QA applying decisions and constraints.
- `review`: the brief before the shot list.

## Impact

- Code: `scripts/lib/issue-sections.mjs` and `scripts/issue-sections.mjs`, `scripts/lib/issue-parse.mjs`, `scripts/lib/issue-check.mjs`, `scripts/check-issue.mjs`, `scripts/lib/plan.mjs`, `scripts/lib/issue-coverage.mjs` and `scripts/issue-coverage.mjs`, `scripts/lib/review-brief.mjs` and `scripts/review-brief.mjs`, `scripts/lib/openspec-commands.mjs`.
- Content: `templates/issue.md`, `docs/issue-format.md`, `skills/issue/SKILL.md` and `skills/issue/references/update.md`, `skills/think/SKILL.md`, `skills/go/SKILL.md`, `skills/review/SKILL.md`, `agents/qa.md`, `agents/dev.md`, `CHANGELOG.md`.
- Not in this change (kept for a follow-up, `Design reference`): the `Design reference` section, `design-fetch.mjs` and the download of pasted images, which need a real test of the token against private attachments. Also not changed: `status` showing the reason of each `needs-spec`, per-stack questions for `issue` (they arrive with the Laravel profile), a Spanish translation of the format page.
