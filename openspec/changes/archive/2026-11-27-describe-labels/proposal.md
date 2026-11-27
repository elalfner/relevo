# Proposal

## Why

The description of a Relevo label says what the state means, not what to do next, so someone who only looks at the board has to open the issue to find out (#224, which follows #223). Repositories that already have the labels would never see new texts, because `init` creates only the labels that are missing.

## What Changes

- The description of each state label, each exit label and `needs-reviewer` (11 labels) says what the label means and then names the next command of the next-step table, or says that nothing is to be done. English only, at most 100 characters.
- `needs-spec` and `build-failed`, whose next step depends on a reason, name the common command and say that the comment says the rest.
- `needs-reviewer` has no command in the table, only an action for the spec writer: its description says that action.
- `ship`, `urgent`, `go` and `local` keep their descriptions.
- `init` gets a plan item, `labels.describe`, that lists each of the 11 labels whose description in the repository differs, with the old and the new text, under its configured name. Accepted, it changes only the description with `gh label edit`.
- The REST version of `gh` used in a web session learns `label edit` with `--description`, which it refuses today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `issue-lifecycle`: label descriptions carry the next step of the table; the description of `build-failed` no longer has to say that the build did not end in a hand-off.
- `init-doctor`: `init` plans and applies the update of label descriptions that differ.

## Impact

- `scripts/lib/labels.mjs` (texts), `scripts/lib/init.mjs` (plan, rendering, apply), `scripts/lib/doctor.mjs` (read the descriptions along with the label names), `scripts/lib/gh-web.mjs` (`label edit`).
- `skills/init/SKILL.md`, `docs/upgrading.md` and `docs/upgrading.es.md`, `CHANGELOG.md`.
- Tests of labels, `init`, `doctor` facts and `gh-web`.
- No new dependency, no workflow template change, no change to `doctor`'s checks.
