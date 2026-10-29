# Proposal

## Why

Flutter and Supabase have a way to get skills into the repository, where the cloud runner reads them; Laravel and Vue have none, so `dev` and `qa` work from the profile text alone. Both stacks have a source worth using, with a catch each. Laravel publishes its coding guidance through Laravel Boost, which installs skills per project from `composer.json` and tells the project it may keep the result out of git, which would hide it from the cloud. Vue has no official skills; the closest set is a community project that calls itself an early experiment, and the official documentation already holds checks the profile lacks.

## What Changes

- **Laravel.** `init` offers two optional installs per Laravel platform folder, `composer require laravel/boost --dev` and `php artisan boost:install --skills`, and asks the person to commit what Boost wrote. `doctor` gives a note when Boost is not in `composer.json`. The `laravel` profile gives `laravel-best-practices` and `pest-testing` to `dev` and `qa` when they are installed, and says nothing when they are not.
- **Vue.** The body of the `vue` profile gains a short checklist from the official documentation (security, performance, tests). `init` offers, labelled as not official, two skills of `vuejs-ai/skills` as an optional install per Vue platform folder, and the `vue` profile gives them to `dev` and `qa` only when they are installed.
- **A list of skills used only when installed.** A profile header key, `skills_when_installed`, lists skills per role that are given to the role when their folder is on the base branch and are skipped without a trace when it is not. `skills.disable` switches them off like any default skill.
- **A warning for skills hidden from the cloud.** `doctor` warns when the skill folder of a platform exists and git ignores it, because the cloud runner reads only what is committed. It applies to every stack.
- The stacks page, in both languages, covers the Laravel and Vue routes.

Out of scope: skills written by Relevo for Vue, skills from the home folder, the package skills of pub.dev, the Boost MCP server and guidelines (`--skills` installs neither), and the skills of Boost for packages other than the two named (they cost up to 10 KB each and apply only when the package is used; a project lists them itself).

This change builds on `recommended-skills-in-project` (merged; its archive waits for a cloud run): `skills.disable`, the lookup in the folder of a platform, the protection of skill folders, and `recommendedInstallCommand`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platforms`: the header key `skills_when_installed`; the Laravel and Vue profiles list skills under it; the Vue profile carries the checklist of the official documentation.
- `role-skills`: a skill listed as used only when installed leaves no note and no warning when absent, and `skills.disable` applies to it.
- `init-doctor`: the Boost installs and the Boost note for a Laravel platform, the optional install of the Vue skills, and the warning for a skill folder ignored by git.
- `documentation`: the stacks page covers both routes.

## Impact

- Code: `scripts/lib/stack-profile.mjs` (parse, merge, `skills.disable` over the new key), `scripts/lib/role-skills.mjs` (silent skip), `scripts/lib/doctor.mjs` (Boost note, ignored-folder warning, install command table), `scripts/lib/init.mjs` (the offers).
- Profiles: `stacks/laravel.md` and `stacks/vue.md`.
- Docs and skills: `docs/stacks.md`, `docs/stacks.es.md`, `skills/init/SKILL.md`, `skills/doctor/SKILL.md`, `CHANGELOG.md`.
- Tests: `tests/stack-profile.test.mjs`, `tests/stack-profiles-shipped.test.mjs`, `tests/role-skills.test.mjs`, `tests/doctor.test.mjs`, `tests/init.test.mjs`, `tests/docs-claims.test.mjs`.
- Behaviour: a Laravel or Vue run reads up to two more skills per role once they are installed and committed; the 20 KB budget per role stays.
