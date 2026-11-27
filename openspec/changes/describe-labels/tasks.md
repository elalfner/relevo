# Tasks

## 1. Descriptions

- [x] 1.1 Replace the 11 descriptions in `scripts/lib/labels.mjs` with the texts of the table in design.md, leaving `ship`, `urgent`, `go` and `local` as they are; verify with `node --test tests/labels.test.mjs`
- [x] 1.2 In `tests/labels.test.mjs`, add the checks of design.md against `next-step.mjs` and the 100-character limit, and replace the old `build-failed` description assertion; verify the tests pass and that a wrong command in one description makes them fail and name the label

## 2. Init item

- [x] 2.1 Have `gatherFacts` in `scripts/lib/doctor.mjs` set `facts.labelDescriptions` from the same call; verify with a case in `tests/doctor.test.mjs`, including a label with no description and labels that cannot be read
- [x] 2.2 Add `labels.describe` to `planInit`, its lines to `renderPlan` and its `gh label edit` calls to `applyPlan` in `scripts/lib/init.mjs`; verify in `tests/init.test.mjs` every scenario of the init-doctor delta except the web session (old texts, accepted, declined, renamed, edited by hand, matching, missing label, requests and marks, files tracker, unreadable)
- [x] 2.3 Add `label edit` (`--repo`, `--description`) to `scripts/lib/gh-web.mjs`; verify in `tests/gh-web.test.mjs` that it sends a `PATCH` with only the description and refuses `--color` and `--name`

## 3. Documentation

- [x] 3.1 Tell in `skills/init/SKILL.md` what `labels.describe` does and that it can be declined alone with `--skip labels.describe`; verify with `node --test` for the skill tests and `npm run validate:plugin`
- [x] 3.2 Say in `docs/upgrading.md` and `docs/upgrading.es.md` that `/relevo:init` offers the new label descriptions, and record the change under `[Unreleased]` in `CHANGELOG.md`; verify with `node --test tests/docs-claims.test.mjs`

## 4. Integration

- [x] 4.1 Run `npm test` and `openspec validate --all`; verify both pass
- [x] 4.2 In the sandbox repository that already has the labels, have a person run `/relevo:init`, read the `labels.describe` item, accept it and read the descriptions on GitHub, with names and colors unchanged and a second plan without the item; record the result
  - 2026-11-27, run by the agent at the person's request, with `scripts/init.mjs` of this branch (not the `/relevo:init` conversation) on `elalfner/relevo-sandbox`: the plan listed the 11 labels with old and new texts; `apply` with the six workflow updates skipped edited the 11 descriptions; read back with `gh label list`, names and colors unchanged, `ship`, `urgent`, `go` and `local` untouched; a second plan had no item. Not tried: the skill conversation and a web session. Open until the person has read the labels on GitHub
  - 2026-11-27, texts rewritten at the person's request to say what each label means before the next step, and applied the same way, with every other item skipped: 11 descriptions changed, names and colors unchanged, a second plan had no item
  - 2026-11-27, closed by the person after being asked to read the labels on GitHub. The `/relevo:init` conversation and a web session remain untried
