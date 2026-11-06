# Tasks

## 1. Facts

- [ ] 1.1 In `gatherFacts` read the repository variable named by a variable-driven `runs-on` (read-only) and record whether it could be read
- [ ] 1.2 Add the published package version fact via the injected `tool`, `null` on any failure, and the changelog sections between pin and published
- [ ] 1.3 Keep `doctor.mjs` wiring read-only; no new write call

## 2. Checks in doctor

- [ ] 2.1 Reword the unreadable linked repository failure (name, `RELEVO_LINKS_TOKEN` or copy the file) and add the unverified-token note for private links
- [ ] 2.2 Extend `runnerChecks` for `vars.NAME` expressions: warn printing both runners and which wins; notes for unparseable or unreadable
- [ ] 2.3 Add the stale pin warning with the changelog summary, and the skip note when the published version is unknown
- [ ] 2.4 Add `repo.protection.checks` (warn when the base branch requires no status checks; could-not-check when unreadable)

## 3. Init

- [ ] 3.1 Add plan items `manual.runner-variable` and `manual.branch-checks`, and extend `manual.links-token`; verify no apply step touches protection or secrets

## 4. Tests

- [ ] 4.1 Tests in `tests/doctor.test.mjs` for every scenario of the spec delta (including offline, no permission, variable unset)
- [ ] 4.2 Tests in `tests/init.test.mjs` for the new plan items and for idempotence
- [ ] 4.3 Test that `doctor` makes no call other than reads
- [ ] 4.4 Run the repository tests (`npm test`) and report any failure

## 5. Docs

- [ ] 5.1 Update `skills/doctor/SKILL.md`, `skills/init/SKILL.md` and the `doctor` section of `docs/commands.md`
- [ ] 5.2 Add a minimal entry under `[Unreleased]` in `CHANGELOG.md`; do not bump `.claude-plugin/plugin.json`
