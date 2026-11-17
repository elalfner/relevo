# Tasks

## 1. The spike of the approval check

- [ ] 1.1 In a sandbox repository, read `lastEditedAt` of an issue with `gh api graphql` using the token of a workflow run (`github.token`) and using a person's `gh`; verify both return a time after a body edit and `null` for an issue never edited
- [ ] 1.2 On the same issue, apply a label, add a comment and change the milestone; verify `lastEditedAt` does not move, and that a title change adds a `renamed` event with its time to the REST timeline
- [ ] 1.3 Write the three results in `docs/pilot-findings.md` with the commands used; if any of them is not as `design.md` D6 assumes, stop here and revise the design before any other task

## 2. The label set

- [x] 2.1 In `tests/labels.test.mjs`, add the `go` and `local` labels (default names, renamable, kind), and tests of `transition`: a move out of `building` removes `local`, a move to another state leaves `go` and `urgent` alone, a move to `building` does not add `local` by itself; run them and see them fail
- [x] 2.2 `scripts/lib/labels.mjs`: the two labels and the rule of `local`; `templates/relevo.yml`: the commented `labels` example; verify the label tests and the config tests pass
- [x] 2.3 `docs/configuration.md` and `docs/configuration.es.md`: the two keys; verify `tests/docs-claims.test.mjs` passes

## 3. What the planner reads

- [x] 3.1 In `tests/github.test.mjs`, test that `gather` gives each candidate `go_by` and `go_at` from the last `labeled` event of `go`, `title_edited_at` from the last `renamed` event, `local_by` for a `building` issue with `local`, and that an issue named by `--only` that carries `go` is read whatever its state; run them and see them fail
- [x] 3.2 `scripts/lib/github.mjs`: read those fields from the timeline already fetched, and the issue of `--only`; a function that reads `lastEditedAt` of one issue and returns the time, `null` or a failure that the caller can tell apart; verify the tests pass
- [x] 3.3 Test the reader of `lastEditedAt` with an injected `gh`: a time, never edited, a failed request, a malformed answer; verify it never throws and never reports "not edited" for a failure

## 4. The planner in the cloud

- [x] 4.1 In `tests/plan.test.mjs`, write the scenarios of the `go` delta for `place: cloud`: `ready` alone is not a candidate; `ready` with a valid `go` passes the gates; `go` by someone without permission, by a non-maintainer when `trust` is `public`, and by a bot; `ready` applied without permission; each refusal of `go` by state; `build-failed` with no branch rebuilt and with a branch refused; `go` removed by every decision; `queued` and `blocked` built later with no label; run them and see them fail
- [x] 4.2 `scripts/lib/plan.mjs`: `place`, the candidates of the cloud, the pair of permissions, the `refuse` decisions and the removal of `go` in every decision; `scripts/go-plan.mjs`: `--place`, and the retry entered by the `go` label; verify the tests of 4.1 and the existing planner tests pass
- [x] 4.3 In `tests/plan.test.mjs`, test that the limit of agents counts the `building` issues without `local`, and that the issues that hold shared files still include the local builds; make it pass in `plan.mjs`
- [x] 4.4 `scripts/lib/messages.mjs`, in English and Spanish: the messages of the refusals (`go` needs `ready`, being built, already built, use `fix`, `go` needs the permission of `ready`, only a maintainer), and the texts that said that `ready` starts a build; `tests/messages.test.mjs` and `tests/messages-language.test.mjs` cover each; verify they pass

## 5. The approval check

- [x] 5.1 In `tests/plan.test.mjs`, test the `unapproved` decision: body edited after `ready_at`, title edited after it, edited by the approver, not edited, the labels it removes (`ready` and `go`), that the issue ends with no lifecycle label, and that a `build-failed` retry with an edited text is refused the same way; and the report that changes nothing when the last edit could not be read; run them and see them fail
- [x] 5.2 `scripts/lib/plan.mjs` and `scripts/go-plan.mjs`: read the last edit only for the issue about to be claimed, decide before any other gate, in both places; the message `approval_withdrawn` that names who approved, in both languages; verify the tests of 5.1 pass
- [x] 5.3 `tests/security-*.test.mjs` or the test that covers the issue hash: the hash check still runs between the claim and the build, and its reason is unchanged; verify it passes

## 6. The planner on a machine

- [x] 6.1 In `tests/plan.test.mjs`, write the scenarios of the `execution-modes` delta for `place: local`: a `ready` issue with no `go` starts; the person's permission and the approver's are both checked; a draft is refused; the capacity gate and the limit of agents are skipped; a shared file gives `shared_files` and no wait; a dependency that is not merged is reported with no label change and no comment; an incomplete text goes to `needs-spec`; a `queued` issue is taken; a `blocked` one is refused; `urgent` changes nothing; the claim adds `building` and `local`; run them and see them fail
- [x] 6.2 `scripts/lib/plan.mjs`: the gates by place, the report decisions and the claim of a local build; `scripts/lib/github.mjs`: `applyDecisions` applies nothing for a report; verify the tests of 6.1 pass
- [x] 6.3 `scripts/lib/go-local.mjs` and `scripts/go-local.mjs`: remove the read of `RELEVO_CLOUD_GO` and the warning; update `tests/go-local.test.mjs`; verify it passes
- [x] 6.4 `skills/go/SKILL.md`: step 1 passes `--place local` without `--decision` and `--place cloud` with it, reports a decision that only informs, and the claim of a local build; `tests/skill-go.test.mjs` covers the three; verify it passes

## 7. The queue and the workflows

- [x] 7.1 In `tests/requeue.test.mjs`, test that the queue owns `queued` and `blocked` issues, a `ready` issue whose `go` label is older than 15 minutes, and not a `ready` issue with a newer `go` or with none; run them and see them fail
- [x] 7.2 `scripts/lib/requeue.mjs` and `scripts/requeue.mjs`: the unanswered request; verify the tests pass
- [x] 7.3 In `tests/workflow-go.test.mjs`, test that the template starts on `relevo:go`, that each failure step removes `relevo:go` where it removes `relevo:ready`, and that the note about renamed labels names both; run them and see them fail
- [x] 7.4 `templates/workflows/relevo-go.yml` and `relevo-queue.yml`, and `templates/agents/antigravity-step.yml` if it names the labels: the trigger, the removals, `--place cloud` in the planner calls and the comments of the file; verify the workflow tests pass
- [x] 7.5 Test the planner with `--credential false`: the issue stays `ready`, loses `go`, and the comment is the one of a cloud that is not configured; make it pass

## 8. A remote session

- [x] 8.1 In `tests/skill-go.test.mjs`, test that the skill, in a remote session and with no `--decision`, builds nothing, asks one yes/no question, applies `go` only on a yes to a `ready` issue with the permission check, applies nothing where the cloud cannot build or the issue is a draft, and answers the same with `--local`; run them and see them fail
- [x] 8.2 A script that says where the skill runs and whether the cloud can build, reusing `isRemote` and `cloudBuilds`, with its test; `skills/go/SKILL.md`: the branch of a remote session before any other step; verify the tests pass

## 9. Issue

- [x] 9.1 In `tests/can-edit-issue.test.mjs`, test the three results: editable, refused with the label, and `withdrawable` for `ready` without `go`; `ready` with `go` is refused; run them and see them fail
- [x] 9.2 `scripts/lib/can-edit-issue.mjs` and `scripts/can-edit-issue.mjs`: the third result with its own exit code; verify the tests pass
- [x] 9.3 In `tests/skill-issue.test.mjs`, test the question of three answers (nothing, `ready`, `ready` and `go`), that `go` is offered only where the cloud can build, that `needs-spec` swapped for `ready` starts nothing, and the withdrawal of the approval before an edit; make them pass in `skills/issue/SKILL.md` and `skills/issue/references/update.md`

## 10. Status, doctor, init and fix

- [x] 10.1 In `tests/status.test.mjs`, test the `ready` issues of the person listed with both ways when the cloud builds and with the command alone when it does not, a `ready` issue with `go` that nothing answers, and the alert of a stuck local build with who started it and the new restart hint; make them pass in `scripts/lib/status.mjs`, its data reader and `skills/status/SKILL.md`
- [x] 10.2 In `tests/doctor.test.mjs`, test the failure for a workflow that starts on `ready` (the `relevo-go-0.12.0.yml` fixture) or on a name that is not the effective `go` label, the warning for an open issue with `local` and without `building`, and the four sentences about what the `go` label does; make them pass in `scripts/lib/doctor.mjs` and `skills/doctor/SKILL.md`
- [x] 10.3 In `tests/init.test.mjs`, test that the `go` and `local` labels are created with the others and that a rewritten workflow starts on `go`; make it pass
- [x] 10.4 `skills/fix/SKILL.md` and `scripts/lib/next-step.mjs`: every text that says to apply `ready` again names the `go` label or `/relevo:go <n> --retry`; `tests/skill-fix.test.mjs` and `tests/next-step.test.mjs` cover it; verify they pass

## 11. The documentation

- [ ] 11.1 `docs/guide.md` and `docs/guide.es.md`: the approval, the build request and the mark of a local build, a draft and how it becomes an approved issue, the three kinds of user, and the scenario of a quota that ran out; verify the documentation tests pass
- [ ] 11.2 `docs/execution.md`, `docs/get-started.md`, `docs/issue-format.md`, `docs/security.md` and their Spanish pages, `README.md` and `README.es.md`: every sentence that says that `ready` starts a build, the pause of the cloud with a pending request, and the approval check in the security page; verify `tests/docs-claims.test.mjs` passes and `grep -rn "ready.*starts\|starts.*ready" docs README.md` finds no claim of the former behaviour
- [ ] 11.3 `CHANGELOG.md`: an entry under Unreleased, marked breaking, with the migration steps of `design.md` in their order and the warning about the window before the workflows are merged; verify it names both new labels

## 12. Integration

- [ ] 12.1 Run the whole suite (`node --test`) and `openspec validate --all`; verify both pass
- [ ] 12.2 In a sandbox repository with the new workflows: approve an issue and verify that no run starts; apply `go` and verify that the cloud builds it and the label is gone; start a local build of a second approved issue and verify that it carries `building` and `local`, that no run starts, and that a third issue with `go` is not queued behind it
- [ ] 12.3 In the same repository: edit the body of an approved issue, apply `go`, and verify that nothing is built, the issue has no lifecycle label and the comment names the approver; pause the cloud, apply `go`, resume, and verify that the queue serves the request
- [ ] 12.4 Record the results of 12.2 and 12.3 in `docs/pilot-findings.md`

## Workflow follow-up

- Built after `rename-qa-failed-label` is merged; its deltas already use `build-failed`.
- Released in the same version as `rename-qa-failed-label`, with one migration section in the changelog.
