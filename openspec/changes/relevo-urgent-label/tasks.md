# Tasks

## 1. The label

- [ ] 1.1 Add `urgent` (`relevo:urgent`, `kind: 'overlay'`, colour and description) to `LABELS` in `scripts/lib/labels.mjs`; verify `tests/labels.test.mjs` passes with a case that `transition()` to `urgent` removes nothing and that `labels.urgent` renames it
- [ ] 1.2 Add `urgent` to `EDITABLE_LABELS` in `scripts/lib/can-edit-issue.mjs` with a reason in `REASON`; verify `tests/can-edit-issue.test.mjs` has a case where a `needs-spec` issue with `relevo:urgent` is editable
- [ ] 1.3 Add an `urgent` entry (no command, nobody to act) to `TABLE` in `scripts/lib/next-step.mjs`, in English and Spanish; verify `tests/next-step.test.mjs` ("every state has an entry") passes
- [ ] 1.4 Verify `init` plans and `doctor` checks the new label with no change to their code: add cases to `tests/init.test.mjs` and `tests/doctor.test.mjs` for a fresh repository, a repository missing only `relevo:urgent`, and a renamed label

## 2. Who applied it

- [ ] 2.1 Generalise `readyEvent` in `scripts/lib/github.mjs` to take the label name, keep `ready` working as before, and have `gather()` set `urgent_by` on the candidates that carry the label; verify `tests/github.test.mjs` covers the last of several `labeled` events and an issue without the label
- [ ] 2.2 Include `urgent_by` in the permission lookup of `gather()` and read the timeline of a candidate once for both labels; verify with a test that counts the API calls for an issue with both labels

## 3. The decision

- [ ] 3.1 In `planGo` compute whether each candidate has a valid `urgent` label with the sets of permissions of `ready`, including `trust: public`, and sort by (not urgent, `ready_at`, number); verify `tests/plan.test.mjs` has the scenarios "Urgent issue jumps the line" and "Several urgent issues"
- [ ] 3.2 Skip gate 3 for a valid urgent issue and leave the global limit, gate 1 and gate 2 as they are; verify the scenarios "Urgent issue for an assignee at capacity", "Urgent issue and no free agent slot", "Urgent issue is still blocked by a dependency" and "Urgent issue with an incomplete spec"
- [ ] 3.3 Remove an invalid `urgent` label in the decision of the issue, add the optional second notice to the decision and render it in `commandsFor`; verify the scenarios "Applied without permission", "Public repository" and "Applied by a bot", and that no notice is posted for a `skip` decision
- [ ] 3.4 Add `urgent` and `built_waiting` to the `start` fields only when the capacity gate was reached; verify a test that a start under the limit has neither
- [ ] 3.5 Verify the existing scenarios of `tests/plan.test.mjs` and `tests/requeue.test.mjs` pass unchanged, and that `scripts/lib/requeue.mjs` applies the new fields with a case where `urgent` is added to a `queued` issue

## 4. Messages and the go skill

- [ ] 4.1 Add the `urgent_denied` message (private-team and public wording) and the optional urgent line of `built` and `blocked_notice` in `scripts/lib/messages.mjs`, in English and Spanish; verify `tests/messages.test.mjs` renders each variant and that no message mentions anyone for a waiting state
- [ ] 4.2 Update `skills/go/SKILL.md` step 7 so the `built` message receives `urgent` and `built_waiting` from the decision; verify the skill tests (`tests/agent-workflow.test.mjs`, `tests/workflow-go.test.mjs`) pass and the decision still decodes as before

## 5. Documentation and release notes

- [ ] 5.1 Document `relevo:urgent` in the pages of `docs/` that list the labels or the queue, in English and Spanish (`how-it-works`, `configuration`, `commands`, `execution`), and verify `tests/docs-claims.test.mjs` passes, since every label a page names must exist
- [ ] 5.2 Add the entry to `CHANGELOG.md` under the next version; verify the changelog test passes and that no attribution line is added

## 6. Integration

- [ ] 6.1 Run `npm test` and `openspec validate relevo-urgent-label --strict`, and verify both pass
- [ ] 6.2 Run `node scripts/go-plan.mjs` against a fixture of a queue with one urgent issue for an assignee at capacity and verify the output starts it and leaves the non-urgent ones `queued`

## Workflow follow-up

- Open a pull request from the work branch to `dev`; `main` only receives `dev` once the CI passes.
- Bump the version and the pinned `RELEVO_VERSION` in the release that includes this change, then archive it with `/opsx:archive`.
