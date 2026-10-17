## Why

`/relevo:create` reads as "create another issue", but the person also needs to rewrite the description of an issue that already exists, and today nothing in the skill allows that. The name should say what the command works on (the issue), and the command should handle both cases.

## What Changes

- Rename the skill `/relevo:create` to `/relevo:issue` (folder, `name`, title, description) and update every reference to it: the skill `think`, both READMEs, the pages `docs/commands` and `docs/install` in both languages, the tests and the capability's specs.
- Add an update mode: `/relevo:issue <number>` reads the issue with `gh issue view`, rewrites its description with the person, checks it with `check-issue.mjs`, asks for explicit approval and applies it with `gh issue edit --body-file`. Without a number it behaves as `create` does today.
- Refuse to edit an issue that Relevo may already be building or is waiting to build. Only an issue with no lifecycle label, or one labelled `needs-spec`, may be edited. For any other state the skill explains that the text is what `go` builds, and says how to proceed: remove `ready` by hand, edit, and apply `ready` again. The skill never changes labels.
- While editing, check that every `Depends-on: #N` still names an existing issue, and keep the `## Documentation` section as it is unless the person asks to change it.
- `/relevo:create` stops existing and no alias is kept: nobody has used it, so there is nothing to migrate. It is recorded in `CHANGELOG.md` as a change of name (see design D6).
- No change to the rules in `check-issue.mjs`; only the comment that cites the spec is updated.

## Capabilities

### New Capabilities
- `issue`: the skill that writes issues and updates the description of an existing one. It is the archived capability `create` renamed (its 11 requirements move over with the word `create` replaced by `issue`), plus the update-mode requirements.

### Modified Capabilities
- `create`: retired. All its requirements are removed here and reappear in `issue`, because a delta cannot rename a capability's folder.
- `think`: the hand-off requirement is renamed to "Think hands off to issue", and the three requirements that name `create` or `/relevo:create` now name `issue` and `/relevo:issue`.

## Impact

- `skills/create/` becomes `skills/issue/`; `skills/think/SKILL.md` (every mention of `/relevo:create` and of `create` as a command).
- `README.md`, `README.es.md` (cover table, row 4: the command column changes, the picture `relevo-state-issue-*.svg` already has the right name), `docs/commands.md`, `docs/commands.es.md`, `docs/install.md`, `docs/install.es.md`.
- `CHANGELOG.md`: an entry under a new unreleased heading recording the new name; the 0.1.0 entry stays as it was released.
- Tests: `tests/skill-create.test.mjs` becomes `tests/skill-issue.test.mjs`; `tests/skill-think.test.mjs` (four assertions), `tests/plugin-structure.test.mjs` (`USER_ONLY`) and `tests/readme-sync.test.mjs` (the seven-command flow) name the new command.
- `scripts/lib/issue-check.mjs` (comment only).
- `openspec/specs/create` is retired and `openspec/specs/issue` is created when this change is archived; `openspec/specs/think` is updated.
- `doctor` does not name `create`, so it needs no change (checked).
- `/relevo:create` is gone; `/relevo:issue` replaces it.
