## Why

The person who runs `/relevo:think` and writes the issues is often a project manager, not someone who uses git. Today `think` writes `GLOSSARY.md` and the decision records and leaves them uncommitted. With the base and release branches protected, those files can only reach the repository through a pull request, and nobody in that role makes one. The vocabulary the person has just settled stays on one machine, and the work that follows (the issue, the build, the review) never sees it.

The pilot showed it: issue #5 of the sandbox introduced two terms (*build number* and *version label*), and the only way to record them was a separate pull request that the person writing the issue would have had to ask for.

## What Changes

- `think` still reads the glossary, challenges terms and settles them with the person, but it no longer writes `GLOSSARY.md` or `docs/adr/` into the repository. It hands the settled terms (name, definition, words to avoid) and any decision record (title and text) over in the agreement, so `/relevo:create` can carry them.
- `/relevo:create` puts them in an optional `## Documentation` section of the issue, with the exact text to add. The section names only `GLOSSARY.md` and `docs/adr/`; it never asks for anything else.
- `go` turns the section into a task of the change and the developer agent writes exactly that text. The files arrive in the same pull request as the feature, which a person already reviews.
- `qa` checks that the glossary and decision-record files changed only by what the issue gave: vocabulary entries with no implementation details, and nothing else in those files.
- The documentation of the issue format and the issue template gain the optional section.
- A person who works alone and wants to commit the glossary by hand is not blocked: nothing forbids it. The change only removes the need.

## Capabilities

### New Capabilities

<!-- None: the behaviour belongs to capabilities that relevo-v1 already specifies. -->

### Modified Capabilities

- `think`: no longer writes `GLOSSARY.md` or decision records into the repository; hands the settled terms and decisions over in the agreement. Replaces "Documentation changes stay uncommitted" and the glossary-writing requirements.
- `create`: writes the optional `Documentation` section of the issue from the agreement, with the exact text.
- `go`: builds the documentation task from the issue, and QA checks that it only adds what the issue gave.

<!-- relevo-v1 is not archived, so these three capabilities exist only as deltas of that change and not in openspec/specs/. This change records its requirements as ADDED under the same capability names. `rename-create-to-issue` renames `create` to `issue` in relevo-v1; whichever change lands second renames the folder. -->

## Impact

- `skills/think/SKILL.md`: the glossary and decision-record handling moves from "write them" to "hand them over".
- `skills/create/SKILL.md`, `templates/issue.md`, `docs/issue-format.md`: the optional `Documentation` section.
- `skills/go/SKILL.md` (step that writes the change specification) and `agents/qa.md` (a check on documentation files).
- `scripts/lib/issue-check.mjs`: no new rule; the section is optional and its content cannot be judged by a script. QA is the check.
- Tests: `tests/skill-think.test.mjs`, `tests/skill-create.test.mjs`, `tests/skill-go.test.mjs`, `tests/agents.test.mjs`.
- `openspec/changes/relevo-v1/specs/think/spec.md` and `specs/create/spec.md` describe the behaviour this change replaces; they are reconciled when this change is archived.
- Users who relied on `think` to write the glossary into their working copy get the entries in the issue instead.
