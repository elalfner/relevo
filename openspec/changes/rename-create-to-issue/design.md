## Context

`skills/create/SKILL.md` drafts issues, checks them with `scripts/check-issue.mjs`, asks for approval and runs `gh issue create`. It has no way to change an issue that exists. `go` builds exactly what the issue says, so the text of an issue that is queued or being built is not free to change. The lifecycle labels (`relevo:ready`, `queued`, `building`, `built`, `in-review`, `pr-open`, and the exits `needs-spec`, `blocked`, `qa-failed`, `changes-requested`, `needs-reviewer`) live in `scripts/lib/labels.mjs`.

`relevo-v1` is archived, so `openspec/specs/create/spec.md` holds the 11 requirements of the skill, including the two about the `## Documentation` section. `openspec/specs/think/spec.md` names `create` in four requirements. Release 0.1.0 is tagged (`v0.1.0`) and its cover, `docs/commands` and `docs/install` pages (both languages) name `/relevo:create`.

## Goals / Non-Goals

**Goals:**
- One command, `/relevo:issue`, for writing a new issue and for rewriting the description of an existing one.
- An update never changes what `go` is about to build or has built.

**Non-Goals:**
- No change to the rules in `check-issue.mjs`; the edited draft goes through the same check.
- No label handling: the skill still never applies, removes or replaces a label.
- No alias for `/relevo:create` (see D6).
- Editing the title, milestone or assignee of an existing issue is not part of this change; only the description.

## Decisions

### D1. The mode comes from the argument

A leading issue number (`42` or `#42`) selects update mode; anything else is the creation flow as it is today. *Alternative rejected*: a separate command such as `/relevo:edit`, which splits one idea (the issue text) across two names and brings back the naming problem.

### D2. Only issues with no lifecycle label, or with `needs-spec`, may be edited

The skill reads the issue with `gh issue view <n> --json number,title,body,state,labels` and refuses unless it is open and carries no label from the lifecycle set, except `needs-spec`.

| Label found | Editable | Why |
|---|---|---|
| none | yes | not started; not an issue Relevo has seen |
| `needs-spec` | yes | `go` returned it because the text is incomplete; fixing the text is the point |
| `ready`, `queued`, `blocked` | no | `go` starts them by itself; the new text would be built without anyone rereading it |
| `building` | no | the agent is working from the current text |
| `built`, `in-review`, `pr-open`, `changes-requested`, `qa-failed`, `needs-reviewer` | no | a branch already exists; the text no longer matches what was built |

The user asked for `ready` and "build in progress"; the other rows follow the same reasoning (the text is already committed to a build) and are recorded here as an assumption. A closed issue is refused too.

The refusal names the label found, explains that what is written is what `go` builds, and gives the way forward: remove `ready` by hand, edit, apply `ready` again, which is also the last point to reread the issue. If a build is running, wait for it to finish or fail first.

The set of lifecycle labels is read from `scripts/lib/labels.mjs` (kind `state` or `exit`), honouring the configured prefix (`relevo:` by default), and not copied into the skill text, so a new label cannot silently make an issue editable. The skill matches labels by that list through a small script rather than by prose. *Alternative rejected*: block only `ready` and `building`; it leaves `blocked` and `queued` editable although they start unattended.

### D3. A small script decides editability

`scripts/can-edit-issue.mjs` takes the `gh issue view` JSON on stdin or a file and prints `editable` or the reason, exiting 0 or 1, in the style of `check-issue.mjs`. The rule is code, not prose, because "the rules that must not vary from run to run" already live in scripts in this plugin and are unit-tested. It reuses the label list from `scripts/lib/labels.mjs`.

### D4. Updating reuses the creation pipeline

Update mode starts from the current body instead of the template, asks only what the person wants to change, and then follows the same steps: draft saved outside the working tree, `check-issue.mjs`, the full new text shown with the old one for comparison, explicit approval, then `gh issue edit <n> --body-file <file>`. Nothing is written before a clear yes. `Depends-on` lines are rechecked: every `#N` must exist (`gh issue view N`), and a draft that depends on an issue that does not exist, or on itself, fails.

### D5. The existing skill test is relaxed in one place

`tests/skill-create.test.mjs` asserts the skill text contains no `gh issue edit`. The renamed test keeps the ban on `--add-label`, `--remove-label` and `--label`, and allows `gh issue edit` only with `--body-file`. This is the check that the skill still never touches labels.

### D6. No alias, and the rename is only recorded

0.1.0 is tagged, but the person who owns the plugin confirmed that nobody has used `/relevo:create`, so there is nothing to migrate. `skills/create/` disappears with no pointer, and `CHANGELOG.md` records the new name under an unreleased heading; the version bump is made on `dev` at release time, as `CLAUDE.md` says. *Alternative rejected*: keep a `skills/create/` that only points to `issue`; it would stay in the structure test, the README table and `think`'s hand-off, and the confusing name would never go away.

### D7. The capability is renamed by moving it, not by editing it

A delta cannot rename a capability folder. The change adds `specs/issue` with the 11 requirements of `create` (the word `create` replaced by `issue`, behaviour unchanged) plus the update-mode ones, and `specs/create` removes all 11, with `retire_capabilities: true` in `.openspec.yaml` so that archiving deletes the empty `create` spec instead of leaving it. `specs/think` renames "Think hands off to create" and modifies the three other requirements that name it. *Alternative rejected*: keep the capability `create` and only add update requirements; the spec would keep a name the command no longer has.

### D8. Update keeps the `Documentation` section

The body of an issue may end with a `## Documentation` section that `go` writes into the repository. Update mode keeps it unless the person asks to change it, shows it whole at approval and accepts only glossary entries and decision records in it. This is a requirement of `issue` ("Updating keeps the documentation section and its limits").

## Risks / Trade-offs

- [Fixing a typo in a `ready` issue now takes three steps] → Accepted: it forces the last reread before a build that costs money. If people keep hitting it, the cause is `think` closing agreements too early, not this rule.
- [The editable set drifts from the lifecycle] → The set is derived from `labels.mjs` by `can-edit-issue.mjs`, with a test that fails when a lifecycle label is neither editable nor refused.
- [The issue gets a label between the check and the edit] → The state is read again right before `gh issue edit`; if it changed, nothing is applied.
- [A reference to `create` is left in a place the tests do not cover] → Task 1.6 searches the whole repository, including `docs/` and the archived-spec text that moves; `readme-sync` already fails if the cover and the commands page disagree.
- [The rename and an unarchived change both edit `think`] → `think-asks-for-reserved-skills` was archived first, so this change starts from the settled `think` spec.
