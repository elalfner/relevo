# Spec Delta

## MODIFIED Requirements

### Requirement: The profile can be extended by the repository but not weakened
A repository MAY add `.relevo/stacks/<stack>.md`. Its lists (tools, skills, generated files) SHALL be added to the plugin's, and its body SHALL be added after the plugin's body. It SHALL NOT remove an item of the plugin or replace a command. A verification command is replaced only through `platforms.<name>.checks` in `relevo.yml`. The repository's header MAY replace a key of its `review` block, which says how the review is driven and is not a verification command, and MAY name skills of the plugin's lists in `skills.disable`, so that a named skill is not given to any role; it SHALL NOT disable a skill of `requires_skills`. When the plugin has no profile for a stack, the file of the repository SHALL be the whole profile.

#### Scenario: Extra hygiene
- **WHEN** the repository's `.relevo/stacks/flutter.md` adds a rule in its body and a generated-file pattern
- **THEN** the resolved profile has the plugin's body followed by the repository's, and both patterns

#### Scenario: A repository tries to remove a check
- **WHEN** the repository's profile sets a command that the plugin's profile also sets
- **THEN** the plugin's command is kept, the resolved profile reports that the repository's value was ignored, and `doctor` warns about it

#### Scenario: Command replaced the supported way
- **WHEN** `platforms.web.checks.test` is `pnpm test`
- **THEN** the resolved profile of `web` uses `pnpm test` for `test` and the plugin's value for the other commands

#### Scenario: Stack defined only by the repository
- **WHEN** a platform has stack `elixir`, the plugin has no such profile and `.relevo/stacks/elixir.md` exists
- **THEN** that file is the profile

#### Scenario: Review key replaced
- **WHEN** the repository's `.relevo/stacks/laravel.md` sets `review.log`
- **THEN** the resolved profile uses the repository's value, and lists `review.log` as replaced

#### Scenario: A default skill switched off
- **WHEN** the repository's `.relevo/stacks/flutter.md` sets `skills.disable: [flutter-add-widget-test]` and the plugin lists that skill for `dev` and `qa`
- **THEN** the resolved profile gives neither role that skill, keeps the others, and `doctor` says the skill is switched off by the repository and not that it is missing

#### Scenario: A required skill cannot be switched off
- **WHEN** `skills.disable` names a skill that the plugin lists under `requires_skills`
- **THEN** the skill stays required, and the resolved profile reports that the entry was ignored

#### Scenario: Disable that names nothing
- **WHEN** `skills.disable` names a skill that no list of the plugin has
- **THEN** the resolved profile reports that the entry matched nothing, and nothing else changes

## ADDED Requirements

### Requirement: The Flutter profile lists a default set of skills for dev and qa
The plugin's `flutter` profile SHALL list a short set of official Dart and Flutter skills under `skills` for `dev` and for `qa`, and none for `issue` and `review`. The set SHALL fit the budget of 20 KB per role, SHALL NOT include a skill that imposes an architecture or a package, and SHALL NOT include a skill with scripts.

#### Scenario: The set
- **WHEN** the profile of `flutter` is resolved
- **THEN** `skills.dev` and `skills.qa` name `flutter-fix-layout-issues`, `flutter-add-widget-test` and `dart-add-unit-test`, and `skills.issue` and `skills.review` are empty

#### Scenario: Budget
- **WHEN** the `SKILL.md` files of the set are added up
- **THEN** their size is below 20 KB for each role

#### Scenario: No imposed architecture
- **WHEN** the set is read
- **THEN** it holds no skill that prescribes a layer structure, a state-management package or an HTTP package
