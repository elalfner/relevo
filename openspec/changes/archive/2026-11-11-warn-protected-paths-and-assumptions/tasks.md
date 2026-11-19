# Tasks

## 1. Protected paths while the issue is written (#119)

- [x] 1.1 Add `scripts/lib/protected-mentions.mjs` with `protectedMentions({ body, allow, rulesFile, platformPaths })`: lines that ask to change a protected path, hard-protected paths that are only named, a manifest only with a verb, skipping fenced code, `Out of scope`, `Code pointers`, `Design reference`, `External inputs` and negated lines; and `mentionText(m)` with the path, the quoted line, why and the ways out. Verify in `tests/protected-mentions.test.mjs` (every scenario of the `issue` delta: task on the rules file, prose, allowed manifest, manifest not allowed, pointer and exclusion, negation, platform skill folder, workflow, `relevo.yml`, Spanish verb).
- [x] 1.2 Call it from `checkIssueDraft` as warnings (one block) and pass `rulesFile` and the platform folders; make the `Allow-paths:` problem name the entry and the rule. Verify in `tests/issue-check.test.mjs` (warning, still `ok`; the `Allow-paths:` problem says why) and by running `check-issue.mjs` on a draft (exit 0 with the warning on stderr).
- [x] 1.3 In `scripts/lib/next-step.mjs`, rewrite the `policy` hint of `needs-spec` and of `qa-failed`, add the `qa-failed` reason `protected`. In `scripts/lib/messages.mjs`, a policy `happened` line for the reason `protected path in the diff` and the choice of the `protected` next step. Verify in `tests/next-step.test.mjs` and `tests/messages.test.mjs` (English and Spanish, the QA-rejected wording unchanged, the table of states still complete).
- [x] 1.4 Edit `skills/issue/SKILL.md` (step 4) and `skills/issue/references/update.md`: show the protected-path warnings and ask which way out, never block. Verify in `tests/skill-issue.test.mjs`.

## 2. Assumptions about outside names (#122)

- [x] 2.1 Add `scripts/lib/assumptions.mjs`: `externalAssumptions(text)`, `settleAssumptions(items, search)`, `repoSearch(root)` (`git grep -F` outside `openspec/`, fails to "not found"), and `assumedLine(unsettled)`. Verify in `tests/assumptions.test.mjs` (a permission not in the repository, a name found, a path of the repository, an assumption about the repository itself, no backticked name, Spanish words, not a git repository).
- [x] 2.2 Call it from `checkIssueDraft` for the `Assumptions` section as a warning with the three ways out (one block; `check-issue.mjs` passes the search over `--repo-root`). Verify in `tests/issue-check.test.mjs`.
- [x] 2.3 In `checkSpecStage`/`scripts/build-preflight.mjs --stage spec`, read the assumptions of `design.md` and print `assumptions` and `assumed`; the decision does not change. Verify in `tests/build-preflight.test.mjs` (listed and `ok`; settled and dropped; no `design.md` assumptions; exit codes).
- [x] 2.4 Add the `assumed` line to the `built` message (English and Spanish, before the branch line). Verify in `tests/messages.test.mjs` (shown, left out when empty).
- [x] 2.5 Edit `skills/issue/SKILL.md` (the External inputs paragraph and step 4): ask to confirm, keep as `manual`, or make it an open question. Verify in `tests/skill-issue.test.mjs`.

## 3. Shared code in the hand-off (#122)

- [x] 3.1 Add `scripts/lib/shared-code.mjs` (path rule, import extraction and resolution for JavaScript/TypeScript/Vue/Svelte and Dart, importer counting without tests) and `scripts/shared-code.mjs` (`--base`, `--repo-root`, `--shared`, fails open). Verify in `tests/shared-code.test.mjs` (every scenario of the `go` delta, in a temporary git repository: modified component with two importers, new component in a shared folder, one-screen component, tests and documents, alias imports, barrel file, unreadable base, a language without a reader).
- [x] 3.2 Add the `shared_code` line to the `built` message (English and Spanish, after `risk`). Verify in `tests/messages.test.mjs`.
- [x] 3.3 Edit `skills/go/SKILL.md` step 7 (small): run `build-preflight.mjs --stage spec` again for `assumed` and `shared-code.mjs` for `shared_code`, and pass both; the model writes neither. Verify in `tests/skill-go.test.mjs`.

## 4. Documentation and check

- [x] 4.1 Document the warnings in `docs/issue-format.md` and `docs/issue-format.es.md`, add a comment to the `Assumptions` section of `templates/issue.md`, and add the entry to `CHANGELOG.md` under Unreleased (no version bump, minimal edit). Verify with `npm test` and `openspec validate warn-protected-paths-and-assumptions`.
- [x] 4.2 Run the whole suite and a manual run of the three scripts on this repository; note in the PR what was not verified. Do not archive the change.
