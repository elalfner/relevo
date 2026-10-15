## 1. Rename create to issue

- [ ] 1.1 Move `skills/create/` to `skills/issue/` with `git mv`; set `name: issue`, the title `Relevo issue` and the description (writes issues and updates an existing one; still never applies the ready label)
- [ ] 1.2 Update `/relevo:create` to `/relevo:issue` in `skills/think/SKILL.md` (description and four more places) and in the `README.md` command table
- [ ] 1.3 In `openspec/changes/relevo-v1`: move `specs/create` to `specs/issue` and rename `create` to `issue` inside it; update `specs/think/spec.md`, `design.md` (D15) and `tasks.md` (3.7, 3.8)
- [ ] 1.4 Update the spec path in the comment of `scripts/lib/issue-check.mjs`; leave its logic untouched
- [ ] 1.5 Move `tests/skill-create.test.mjs` to `tests/skill-issue.test.mjs` and point it, and `tests/skill-think.test.mjs`, at `skills/issue/SKILL.md` and `/relevo:issue`
- [ ] 1.6 Search the repository for `relevo:create`, `skills/create` and `specs/create` and confirm no reference is left (`doctor` has none)

## 2. Decide whether an issue may be edited

- [ ] 2.1 Add `scripts/can-edit-issue.mjs`: reads the `gh issue view --json number,title,body,state,labels` output from a file or stdin; prints `editable`, or the label and the reason; exit 0 editable, 1 refused, 2 bad arguments. Editable only when open and with no lifecycle label except `needs-spec`; lifecycle labels and prefix come from `scripts/lib/labels.mjs`
- [ ] 2.2 Add `tests/can-edit-issue.test.mjs` with one case per scenario of "Only an issue Relevo has not committed to a build may be edited" (ready, building, blocked, queued, built, needs-spec, no label, closed) and one that fails if a lifecycle label is neither editable nor refused

## 3. Update mode in the skill

- [ ] 3.1 In `skills/issue/SKILL.md` add the mode choice by argument (number or `#number` is an update; anything else is creation) and update `argument-hint`
- [ ] 3.2 Add the update flow: read with `gh issue view`, run `can-edit-issue.mjs` and relay the refusal with the way forward (remove `ready` by hand, edit, apply it again), start from the current body, ask only what changes, keep the rest
- [ ] 3.3 Add the dependency recheck: every `Depends-on: #N` must exist (`gh issue view N`) and must not be the issue itself
- [ ] 3.4 Add the approval step for updates: run `check-issue.mjs`, show new text beside the current one, wait for a clear yes, read the labels again, then `gh issue edit <n> --body-file <file>`; the skill still applies no label
- [ ] 3.5 Update the "Never" list: never edit an issue `can-edit-issue.mjs` refuses, never change labels, title, milestone or assignee of an existing issue

## 4. Tests of the skill

- [ ] 4.1 In `tests/skill-issue.test.mjs` check the frontmatter (`name: issue`, argument hint, `disable-model-invocation`), that `can-edit-issue.mjs` and `check-issue.mjs` exist and are referenced, and that the check comes before `gh issue create` and before `gh issue edit`
- [ ] 4.2 Relax the label test: still forbid `--add-label`, `--remove-label` and `--label`; allow `gh issue edit` only together with `--body-file`
- [ ] 4.3 Add checks for the update scenarios: mode by number, refusal text names removing `ready` by hand, approval required before editing, labels read again before applying, dependency recheck
- [ ] 4.4 Run `npm test` and `openspec validate rename-create-to-issue`

## 5. Close out

- [ ] 5.1 Update the `README.md` row for `/relevo:issue` to mention that it also updates an existing issue
- [ ] 5.2 Archive order: archive `relevo-v1` first, then this change, so `issue` exists in the main specs when this change adds to it
