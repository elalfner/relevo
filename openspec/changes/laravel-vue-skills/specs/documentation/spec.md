# Spec Delta

## ADDED Requirements

### Requirement: The stacks page explains the Laravel skills
The stacks page, in both languages, SHALL give the Laravel Boost commands, say that Boost chooses skills from `composer.json` and that `--skills` installs neither guidelines nor the MCP server, say that the generated skills must be committed even though Laravel allows ignoring them, and name the two skills the profile uses.

#### Scenario: Laravel
- **WHEN** the section on Laravel of the stacks page is read
- **THEN** it gives `composer require laravel/boost --dev` and `php artisan boost:install --skills --no-interaction` run from the folder of the platform, says to commit `.claude/skills/`, `boost.json`, `composer.json` and `composer.lock`, and names `laravel-best-practices` and `testing-best-practices`

#### Scenario: Skills of other packages
- **WHEN** the section is read
- **THEN** it says that Boost installs skills for the packages the project uses and that a project lists those it wants under `skills` in `.relevo/stacks/laravel.md`

#### Scenario: Switch off
- **WHEN** the section is read
- **THEN** it says to name a skill under `skills.disable` in `.relevo/stacks/laravel.md` to switch it off

### Requirement: The stacks page explains the Vue skills
The stacks page, in both languages, SHALL say that Vue publishes no official skills, that the two offered come from a community project that calls itself an early experiment, give their install command, and say that the profile uses them only when installed and how to switch one off.

#### Scenario: Vue
- **WHEN** the section on Vue of the stacks page is read
- **THEN** it says that Vue publishes no skills, that `vuejs-ai/skills` is a community project that calls itself an early experiment, gives the install command, and says that `dev` and `qa` use `vue-best-practices` and `vue-testing-best-practices` only when installed

#### Scenario: Switch off
- **WHEN** the section is read
- **THEN** it says to name a skill under `skills.disable` in `.relevo/stacks/vue.md` to switch it off

#### Scenario: Both languages
- **WHEN** the English and the Spanish stacks pages are compared
- **THEN** both carry the same sections with the same commands
