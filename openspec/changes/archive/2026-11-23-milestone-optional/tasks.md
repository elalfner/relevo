# Tasks

## 1. The planner and its message

- [x] 1.1 In `tests/plan.test.mjs`, `tests/go-plan-output.test.mjs` and `tests/github.test.mjs`, replace the expectations of `no-milestone` with `start` for an issue with `milestone: null` (cloud, `--retry` and local), drop `no-milestone` from the summary and the "request consumed" cases, and keep the no-assignee and needs-spec cases; run them and see them fail
- [x] 1.2 `scripts/lib/plan.mjs`: remove the milestone gate and update the comment that lists the gates; verify the tests of 1.1 pass
- [x] 1.3 In `tests/messages.test.mjs` and `tests/messages-language.test.mjs`, remove the kind `no_milestone` from the lists of kinds and their data; run them and see them fail
- [x] 1.4 `scripts/lib/messages.mjs`: remove `no_milestone` from the field table and from the English and Spanish catalogs; verify the message tests pass and `grep -rn "no_milestone\|no-milestone" scripts` finds nothing

## 2. The skills and the workflow template

- [x] 2.1 `skills/go/SKILL.md`: remove `no-milestone` from the list of normal outcomes and from the `--reason` line, and remove the milestone from the list of gates of a local build; verify `tests/skill-go.test.mjs` passes and `grep -n "milestone" skills/go/SKILL.md` finds nothing
- [x] 2.2 `templates/workflows/relevo-go.yml`: remove "no milestone" from the comment at the light job; verify `tests/workflow-go.test.mjs` passes (the fixture `tests/fixtures/workflows/relevo-go-0.12.0.yml` stays as it is)
- [x] 2.3 In `tests/skill-issue.test.mjs`, add a test that the approval step offers "none" for the milestone and that the create step passes `--milestone` only when there is one; run it and see it fail
- [x] 2.4 `skills/issue/SKILL.md`: offer "none" next to the open milestones, accept it once without asking again, show the draft with no milestone, and create the issue without `--milestone` (a linked repository too); verify the skill tests pass

## 3. Documentation and release notes

- [x] 3.1 `docs/issue-format.md` and `docs/issue-format.es.md`: the milestone is optional and recommended ("the batch or cut the issue belongs to"), and "if any of these is missing" now names only the assignee and the labels; verify `tests/docs-claims.test.mjs` passes
- [x] 3.2 `docs/get-started.md` and `docs/get-started.es.md`: remove "Relevo builds only issues that belong to one" and the milestone from the list of things to check when nothing starts, keeping the glossary term that the claims test requires; verify `tests/docs-claims.test.mjs` passes
- [x] 3.3 `docs/how-it-works.md` and `docs/how-it-works.es.md`: change the line of the diagram so it does not say the build needs a milestone; verify the page still renders as plain text and the docs tests pass
- [x] 3.4 `CHANGELOG.md`, under `[Unreleased]`: an entry marked **Breaking for whoever relied on it** that says a missing milestone no longer stops `go`, that `/relevo:issue` still asks and now accepts "none", and that `status` is unchanged; the version is bumped later in the release commit that `RELEASING.md` describes, as for every earlier change, so it is not touched here; verify `tests/plugin-structure.test.mjs` passes

## 4. Final checks

- [x] 4.1 Run `npm test` and `openspec validate --all` (the CI steps) and verify both are green
- [x] 4.2 Run `grep -rniE "no.milestone|no_milestone" scripts skills templates docs openspec/specs --include=* ` and verify the only hits are historical (`docs/pilot-findings.md`) or inside this change

## Workflow follow-up

- Check the branch with `git branch --show-current` before every commit; the work goes through `dev`, never straight to `main`.
- Archive the change after the pull request is merged, then run `npm test` and `openspec validate --all` again.
