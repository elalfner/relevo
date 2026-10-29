# Spec Delta

## ADDED Requirements

### Requirement: A profile can list skills that are used only when installed
A profile header MAY carry `skills_when_installed`, a map from a role (`dev`, `qa`, `issue`, `review`) to skill names. A listed skill SHALL be given to the role when its folder is on the base branch and SHALL be skipped without a note or a warning when it is not. The repository's profile MAY carry the key too, and its lists SHALL be added to the plugin's. `skills.disable` SHALL switch off a skill of these lists as it does for the others.

#### Scenario: Listed and installed
- **WHEN** the plugin lists `pest-testing` for `dev` under `skills_when_installed` and its folder is on the base branch
- **THEN** the resolved profile gives `dev` that skill

#### Scenario: Listed and absent
- **WHEN** the folder of the skill is not on the base branch
- **THEN** the skill is not given to the role, and nothing is reported for it

#### Scenario: Unknown role
- **WHEN** `skills_when_installed` has a key that is not a role
- **THEN** resolving the profile fails and names the key

#### Scenario: Switched off
- **WHEN** the repository's `skills.disable` names a skill of `skills_when_installed`
- **THEN** the resolved profile does not give it to any role

#### Scenario: Added by the repository
- **WHEN** the repository's `.relevo/stacks/laravel.md` lists another skill under `skills_when_installed`
- **THEN** the resolved profile has the plugin's skills followed by the repository's

### Requirement: The Laravel profile uses the skills of Laravel Boost when installed
The plugin's `laravel` profile SHALL list `laravel-best-practices` and `pest-testing` under `skills_when_installed` for `dev` and for `qa`, and no skill under `requires_skills` or `skills`. The two SHALL fit the budget of 20 KB per role. It SHALL NOT list a skill that applies only when a package is used, such as `livewire-development`.

#### Scenario: The set
- **WHEN** the profile of `laravel` is resolved
- **THEN** `skills_when_installed.dev` and `skills_when_installed.qa` name `laravel-best-practices` and `pest-testing`, and `requires_skills` and every `skills` list are empty

#### Scenario: A project with PHPUnit
- **WHEN** the project does not use Pest, so `pest-testing` is not installed
- **THEN** the run is not affected and nothing is reported about that skill

#### Scenario: Budget
- **WHEN** the `SKILL.md` files of the two skills are added up
- **THEN** their size is below 20 KB

### Requirement: The Vue profile uses two community skills when installed
The plugin's `vue` profile SHALL list `vue-best-practices` and `vue-testing-best-practices` under `skills_when_installed` for `dev` and for `qa`, and no skill under `requires_skills` or `skills`. The two SHALL fit the budget of 20 KB per role and SHALL have no scripts. The profile SHALL NOT call them official.

#### Scenario: The set
- **WHEN** the profile of `vue` is resolved
- **THEN** `skills_when_installed.dev` and `skills_when_installed.qa` name the two skills, and `requires_skills` and every `skills` list are empty

#### Scenario: Not installed
- **WHEN** the folders of the two skills are not on the base branch
- **THEN** the run is not affected and nothing is reported about them

#### Scenario: Budget and scripts
- **WHEN** the two skills are read
- **THEN** their `SKILL.md` files add up to less than 20 KB, and neither folder holds a script

### Requirement: The Vue profile carries the checks of the official documentation
The body of the plugin's `vue` profile SHALL tell the developer to avoid, and QA to look for in the diff, the security, performance and testing points of the Vue documentation that can be read in a diff, in less than 2 KB of added text. It SHALL keep the existing rule not to repeat what `analyze` enforces.

#### Scenario: Security in the diff
- **WHEN** the body of the `vue` profile is read
- **THEN** it names a template built from user text, `innerHTML` in a render function, a `:href` or `:src` bound to a user URL that may start with `javascript:`, and `:style` bound to CSS written by a user

#### Scenario: Performance in the diff
- **WHEN** the body is read
- **THEN** it names a prop that changes for every item of a list when only one item should update, deep reactivity on large immutable data where `shallowRef` fits, a list of hundreds of items that is not virtualized, and a wrapper component repeated for every item of a long list

#### Scenario: Tests
- **WHEN** the body is read
- **THEN** it says to test what a component does and not how, to simulate user input and not call methods, to assert on the rendered DOM, to not rely on snapshots alone, and to test a composable that uses lifecycle hooks through a host component

#### Scenario: Size
- **WHEN** the body of the profile is compared with its size before this change
- **THEN** it grew by less than 2 KB
