# Tasks

## 1. Check what the design leaves unverified

- [x] 1.1 In a scratch Laravel project outside the repository (`composer create-project laravel/laravel`), run `composer require laravel/boost --dev` and `php artisan boost:install --skills` with and without `--no-interaction`; write down whether it asks which agents, where the skills land, the files of each installed folder (no script among them), the sizes of the `SKILL.md` of `laravel-best-practices` and `pest-testing`, and what changed in `composer.json` and `.gitignore`; record the result in the Risks of `design.md` and, if `laravel-best-practices` is not written, fix the set in the spec scenario "The set"
- [x] 1.2 In a scratch folder, run `npx skills add vuejs-ai/skills --skill vue-best-practices --skill vue-testing-best-practices --agent claude-code --copy --yes`, check that the folders are real files with no script, read both skills for steps that run the app or impose a package, and record the sizes; fix the set in "The Vue profile uses two community skills when installed" if one fails
- [x] 1.3 Read the Vue checklist against the pages it comes from (security, performance, testing) and write the text, under 2 KB, in the scratch folder; verify its size with `wc -c`

## 2. A list of skills used only when installed

- [x] 2.1 In `scripts/lib/stack-profile.mjs`, parse `skills_when_installed` (a map from a role to names, an error for another key), join it in `mergeProfiles`, remove from it the names of `skills.disable`, and carry which names the plugin listed; verify with the scenarios of "A profile can list skills that are used only when installed" in `tests/stack-profile.test.mjs`
- [x] 2.2 In `scripts/lib/role-skills.mjs`, give each role the skills of this key whose folder is on the base branch, marked as default, leave the absent ones out of the output, and keep reporting a present one that has scripts or is reserved; print the key in `scripts/stack-profile.mjs`; verify with the scenarios of "A skill used only when installed leaves no trace when absent" in `tests/role-skills.test.mjs`
- [x] 2.3 In `scripts/lib/doctor.mjs`, make `doctor` skip a skill that is absent from this key and count the present ones in the size budget; verify in `tests/doctor.test.mjs` that an absent one gives no note and no warning and that a present one with scripts is reported

## 3. The profiles

- [x] 3.1 List the Laravel skills under `skills_when_installed` for `dev` and `qa` in `stacks/laravel.md`; verify with `tests/stack-profiles-shipped.test.mjs` (the set, the empty `requires_skills` and `skills`, the size under 20 KB)
- [x] 3.2 List the two Vue skills in `stacks/vue.md` and add the checklist of task 1.3 to its body; verify with `tests/stack-profiles-shipped.test.mjs` (the set, the size of the body grew by less than 2 KB, and the body names each point of the scenarios of "The Vue profile carries the checks of the official documentation")

## 4. Doctor and init

- [x] 4.1 In `scripts/lib/doctor.mjs`, read `composer.json` of each Laravel platform and report the note `recommended.laravel.boost`, the note for Boost present with no committed skill, and the pass, as the scenarios of "Doctor notes when Laravel Boost is missing" say; verify in `tests/doctor.test.mjs`, including no composer file and no Laravel platform
- [x] 4.2 In `scripts/lib/doctor.mjs`, warn when a skill folder of a platform or of the root exists and `git check-ignore` reports it ignored, and say nothing when git cannot tell; verify with the scenarios of "Doctor warns when a skill folder is ignored by git" in `tests/doctor.test.mjs`
- [x] 4.3 In `scripts/lib/init.mjs`, plan the two Boost installs per Laravel platform folder, the manual step to commit, with `--no-interaction` for the second, and list committing `.claude/skills/`, `boost.json`, `composer.json` and `composer.lock` as a manual step; verify with the scenarios of "Init offers the Laravel Boost skills as optional installs" in `tests/init.test.mjs`
- [x] 4.4 In `scripts/lib/init.mjs`, plan the optional install of the two Vue skills per Vue platform folder with the label that they are not official, from a table kept apart from `RECOMMENDED`; verify with the scenarios of "Init offers the community Vue skills, labelled as not official" in `tests/init.test.mjs`, and that `doctor` reports nothing when they are absent
- [x] 4.5 Update `skills/init/SKILL.md` and `skills/doctor/SKILL.md` for the Boost offers, the Vue offer and the ignored-folder warning, and verify `tests/skill-init-doctor.test.mjs` passes

## 5. Documentation

- [x] 5.1 Add the Laravel and Vue sections to `docs/stacks.md` and `docs/stacks.es.md` with the commands, the commit advice, the two skills of each stack, how to list others and how to switch one off; verify with `tests/docs-claims.test.mjs` and by reading that both pages carry the same commands
- [x] 5.2 Add the entry under `## [Unreleased]` in `CHANGELOG.md` (Added: the key, the Laravel and Vue offers, the checklist, the warning; Known limits: the skills of other Boost packages are not listed by default, the Vue skills are unofficial); verify the file keeps its format

## 6. Whole change

- [x] 6.1 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged, then run `npm test` and `openspec validate --all` again.
- `recommended-skills-in-project` still waits for a cloud run before it is archived; this change does not depend on it for its own tasks.
