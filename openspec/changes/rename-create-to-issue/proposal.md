## Why

`/relevo:create` reads as "create another issue", but the person also needs to rewrite the description of an issue that already exists, and today nothing in the skill allows that. The name should say what the command works on (the issue), and the command should handle both cases.

## What Changes

- Rename the skill `/relevo:create` to `/relevo:issue` (folder, `name`, title, description) and update every reference to it.
- Add an update mode: `/relevo:issue <number>` reads the issue with `gh issue view`, rewrites its description with the person, checks it with `check-issue.mjs`, asks for explicit approval and applies it with `gh issue edit --body-file`. Without a number it behaves as `create` does today.
- Refuse to edit an issue that Relevo may already be building or is waiting to build. Only an issue with no lifecycle label, or one labelled `needs-spec`, may be edited. For any other state the skill explains that the text is what `go` builds, and says how to proceed: remove `ready` by hand, edit, and apply `ready` again. The skill never changes labels.
- While editing, check that every `Depends-on: #N` still names an existing issue.
- No change to the rules in `check-issue.mjs`; only the comment that cites the spec is updated.

## Capabilities

### New Capabilities
- `issue`: the skill that writes issues and updates the description of an existing one. It is the capability `create` of `relevo-v1`, renamed, plus the update mode.

### Modified Capabilities
<!-- None in openspec/specs/: relevo-v1 is not archived yet, so `create` exists only as a delta of that change. Its spec folder is renamed there (task 1.3) and this change adds the update-mode requirements to `issue`. Archive relevo-v1 first. -->

## Impact

- `skills/create/` becomes `skills/issue/`; `skills/think/SKILL.md` (hand-off, five references) and `README.md` (command table).
- Tests: `tests/skill-create.test.mjs` becomes `tests/skill-issue.test.mjs`; `tests/skill-think.test.mjs` points to the new path.
- `scripts/lib/issue-check.mjs` (comment only).
- `openspec/changes/relevo-v1`: `specs/create` becomes `specs/issue`, and the references in `specs/think/spec.md`, `design.md` and `tasks.md` are updated.
- `doctor` does not name `create`, so it needs no change (checked).
- Users who learned `/relevo:create` must use `/relevo:issue`; the plugin is still at 0.1.0 and unreleased, so no alias is kept.
