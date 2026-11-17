# Tasks

## 1. The label set and the configuration

- [ ] 1.1 In `tests/labels.test.mjs` and the config tests, change the expectations to the key `build-failed` and the name `relevo:build-failed`, add a test that `labels: { qa-failed: x }` fails with a message that names `build-failed`, and a test of the new description; run them and see them fail
- [ ] 1.2 `scripts/lib/labels.mjs`: key `build-failed`, name `relevo:build-failed`, description "The build did not end in a hand-off; the comment says why and what to do"; verify the label tests pass
- [ ] 1.3 `scripts/lib/config.mjs`: reject the former key `qa-failed` of `labels` with the message that gives the new key; `templates/relevo.yml`: the commented `labels` example; verify the config tests pass and `node scripts/validate-config.mjs` accepts the template
- [ ] 1.4 `docs/configuration.md` and `docs/configuration.es.md`: the key of the label; verify `tests/docs-claims.test.mjs` passes

## 2. The scripts that read the state

- [ ] 2.1 Update the expectations of `tests/plan.test.mjs`, `tests/github.test.mjs`, `tests/go-plan-output.test.mjs`, `tests/status.test.mjs`, `tests/stages.test.mjs`, `tests/ship.test.mjs`, `tests/next-step.test.mjs`, `tests/fix.test.mjs`, `tests/limit-retry.test.mjs` and `tests/acceptance.test.mjs` to the new key; run them and see them fail
- [ ] 2.2 Rename the key in `scripts/lib/plan.mjs`, `scripts/lib/github.mjs`, `scripts/go-plan.mjs`, `scripts/lib/status.mjs`, `scripts/lib/stages.mjs`, `scripts/lib/ship.mjs`, `scripts/lib/can-edit-issue.mjs`, `scripts/lib/next-step.mjs`, `scripts/next-step.mjs`, `scripts/lib/fix.mjs`, `scripts/fix-state.mjs`, `scripts/restricted-check.mjs`, `scripts/lib/go-local.mjs` and `scripts/go-local.mjs`, comments included; verify the tests of 2.1 pass and `grep -rn "qa-failed" scripts` finds only the refusal of 1.3
- [ ] 2.3 Add a test that `failure-comment.mjs` still recognises the work of a failed build by the subject of its commit when the issue carries `relevo:build-failed`; verify it passes without a code change, or fix what it finds

## 3. The messages

- [ ] 3.1 In `tests/messages.test.mjs`, `tests/messages-language.test.mjs`, `tests/workflow-comments.test.mjs` and `tests/wip-commit.test.mjs`, rename the kind `qa_failed` to `build_failed` and the label named in the expected texts, in English and Spanish; run them and see them fail
- [ ] 3.2 `scripts/lib/messages.mjs`: the kind `build_failed`, its helpers (`qaFailedReason` and the others), and every text that names the label, in both languages; the reasons and the classes `qa-non-fixable` and `qa-fixable-after-retries` stay; verify the tests of 3.1 pass and `grep -n "qa_failed\|qaFailed" scripts -r` finds nothing

## 4. The templates and the skills

- [ ] 4.1 Update `tests/workflow-go.test.mjs`, `tests/workflow-limit-retry.test.mjs`, `tests/toolchain-check.test.mjs`, `tests/adapter-antigravity.test.mjs`, `tests/skill-go.test.mjs` and `tests/skill-fix.test.mjs` to the new label and the new message kind; leave `tests/fixtures/workflows/relevo-go-0.12.0.yml` as it is; run them and see them fail
- [ ] 4.2 `templates/workflows/relevo-go.yml`: every `gh issue edit` that applies or removes the label, the texts of its comments and the note about renamed labels; `templates/agents/antigravity-step.yml` if it names it; verify the workflow tests pass
- [ ] 4.3 `skills/go/SKILL.md` and its references, `skills/fix/SKILL.md`, `skills/status/SKILL.md` and `skills/issue` (with `references/update.md`): the label, `render-message.mjs build_failed` and `next-step.mjs --state build-failed`; verify the skill tests pass and `grep -rn "qa-failed\|qa_failed" skills templates` finds nothing

## 5. Init and doctor

- [ ] 5.1 Tests for `init`: only the former label exists (one rename call, then the creation of the others, and the report says it was renamed), neither exists (created), both exist (nothing renamed or deleted, the issues that carry the former one are listed); run them and see them fail
- [ ] 5.2 `scripts/lib/init.mjs`: plan and carry out the rename with `PATCH repos/{repo}/labels/{former name}` before the labels are created, and the report for each case; verify the tests of 5.1 pass
- [ ] 5.3 Tests for `doctor`: a repository with the former label fails and points to `init`; an installed workflow that names it (the `relevo-go-0.12.0.yml` fixture) fails and names the file; a migrated repository reports nothing; run them and see them fail
- [ ] 5.4 `scripts/lib/doctor.mjs`: the two checks, under the existing label and workflow results; `skills/init/SKILL.md` and `skills/doctor/SKILL.md` say what they do; verify the tests of 5.3 pass

## 6. The documentation

- [ ] 6.1 Rename the label and use the term failed build in every page of `docs/` that names it, in English and Spanish, and in `README.md` and `README.es.md` if they do; history in `docs/pilot-findings.md` and in earlier entries of `CHANGELOG.md` stays as it was written; verify `tests/docs-claims.test.mjs` passes and `grep -rln "qa-failed" docs` lists only `pilot-findings.md`
- [ ] 6.2 `CHANGELOG.md`: an entry under Unreleased, Changed, marked breaking, with the migration (update the plugin, run `/relevo:init`, change the key in `relevo.yml`, run `/relevo:doctor`); verify it reads as the steps of `design.md`

## 7. Integration

- [ ] 7.1 Run the whole suite (`node --test`) and `openspec validate --all`; verify both pass
- [ ] 7.2 `grep -rn "qa-failed\|qa_failed\|qaFailed" --exclude-dir=openspec --exclude-dir=node_modules --exclude-dir=.git .` and verify that what is left is only: the refusal of the former key, the two checks of `doctor` and the rename of `init` with their tests, the old-template fixture, `docs/pilot-findings.md` and earlier changelog entries

## Workflow follow-up

- After the archive, correct by hand the three scenario titles that a delta cannot rename: "Fix after qa-failed" in `openspec/specs/fix/spec.md`, and "Retry of a qa-failed issue without a branch" and "The issue is not qa-failed" in `openspec/specs/go/spec.md`.
- Merge this change before `split-ready-and-go`, `build-runner-labels` and `go-visibility` are built.
