# Tasks

## 1. Wording in init

- [x] 1.1 In `scripts/lib/init.mjs`, change the `stack-profile.<stack>` plan text from "(not committed)" to "(left for you to commit)" and the comment above it to match. Update the title of the scenario in `tests/init.test.mjs` and assert the new text. Verify with `node --test tests/init.test.mjs`.
- [x] 1.2 In `skills/init/SKILL.md`, say in the platforms question that the profile file is created and left for the person to commit (`init` does not commit it), and in the Report that the new files to commit and push include each `.relevo/stacks/<stack>.md` it created. Verify with `node --test tests/skill-init-doctor.test.mjs`.

## 2. Doctor warning

- [x] 2.1 In `gatherPlatforms` (`scripts/lib/doctor.mjs`), when a resolved profile's `layers` includes `repository`, record `repositoryLayerTracked` on the entry with `git ls-files --error-unmatch .relevo/stacks/<stack>.md` through the probes: `true` when it succeeds, `false` when git runs and the path is untracked, `null` when git is missing or the folder is not a repository.
- [x] 2.2 In `platformChecks`, after `platform.<name>.profile`, emit the warning `platform.<name>.profile.tracked` when `repositoryLayerTracked` is `false`: with the plugin layer, that the cloud run and a fresh clone use only the plugin's profile; without it, that they have no profile for the stack. The fix says to commit `.relevo/stacks/<stack>.md`. Nothing when it is `true` or `null`.
- [x] 2.3 Add cases to `tests/doctor.test.mjs` for each scenario of the delta spec: untracked with the plugin layer, untracked as the only layer, tracked (no warning), and git unavailable (no warning). Verify with `node --test tests/doctor.test.mjs`.

## 3. Documentation

- [x] 3.1 In `docs/stacks.md` and `docs/stacks.es.md`, say under "Adding your own rules" that the third-layer file is meant to be committed (the cloud and teammates read it from git), that `init` leaves it for you to commit, and that `doctor` warns while it is untracked. Make the same point in one sentence in `docs/configuration.md` and `docs/configuration.es.md`. Verify with `node --test tests/readme-sync.test.mjs` if it covers these pages.
- [x] 3.2 Add an entry under Unreleased in `CHANGELOG.md` (Fixed: the wording; Added: the `doctor` warning). Verify with `node --test tests/changelog.test.mjs`.

## 4. Check

- [x] 4.1 Run `npm test` and `openspec validate stack-profile-left-to-commit --strict`. Verify that every test passes and validation reports no error.
- [x] 4.2 In a throwaway git repository with a `relevo.yml` and an untracked `.relevo/stacks/flutter.md`, run `node scripts/doctor.mjs` and confirm the warning; `git add` the file and confirm it disappears.

## Workflow follow-up

- Archive the change after review, syncing the delta into `openspec/specs/init-doctor/spec.md`.
