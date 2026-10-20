## ADDED Requirements

### Requirement: The plugin ships profiles for Vue and Laravel
The plugin SHALL ship the profiles `vue` (target `web`) and `laravel` (no targets), each naming `analyze`, `test` and `format`. The commands that QA runs SHALL NOT modify files: the `analyze` and `test` commands of a profile write nothing the repository tracks, and only `format` may. A profile SHALL NOT require a skill that the plugin does not ship; it SHALL tell the repository where to add its own.

#### Scenario: Vue profile
- **WHEN** the profile of `vue` is read
- **THEN** its `analyze` runs the type check and the linter without a fix option, its `test` runs the unit tests once, its `format` writes with Prettier, and it defines the target `web`

#### Scenario: Laravel profile
- **WHEN** the profile of `laravel` is read
- **THEN** its `analyze` runs Pint in test mode, its `test` runs `php artisan test`, its `format` runs Pint, and it defines no targets

#### Scenario: Stack with a static analyser
- **WHEN** a repository uses PHPStan
- **THEN** it replaces `analyze` with `platforms.<name>.checks` in `relevo.yml`, and the profile of the plugin does not change

### Requirement: A profile can carry questions for the issue writer, apart from its body
A profile MAY have a section `Questions for the issue writer`. That section SHALL NOT be part of the body that `dev` and `qa` receive, and the profile command SHALL print it only when asked for the role `issue`. The sections of the plugin's profile and of the repository's SHALL be joined.

#### Scenario: Agents do not receive the questions
- **WHEN** the profile of `laravel` is resolved for `dev` or `qa`
- **THEN** its body does not contain the questions

#### Scenario: Issue asks for them
- **WHEN** the profile is resolved with the role `issue`
- **THEN** the output is the questions of the plugin's profile followed by the repository's

#### Scenario: Profile without questions
- **WHEN** a profile has no such section
- **THEN** the role `issue` prints an empty list and nothing fails
