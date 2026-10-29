# platforms Specification

## Purpose
TBD - created by archiving change platform-registry. Update Purpose after archive.

## Requirements

### Requirement: Platforms are declared in a registry
`relevo.yml` SHALL declare the platforms of the repository in `platforms`, a map of name to `stack` (required), `path` (a directory of the repository, default `.`) and `targets` (a list, only for stacks that define targets). The legacy `platform: flutter-android` SHALL stay valid and mean one platform with `stack: flutter`, `path: .` and `targets: [android]`. Setting both `platform` and `platforms` SHALL fail validation.

#### Scenario: Legacy setting
- **WHEN** `relevo.yml` has `platform: flutter-android` and no `platforms`
- **THEN** validation passes and the commands see one platform with stack `flutter`, path `.` and targets `[android]`

#### Scenario: Monorepo
- **WHEN** `platforms` has `web` (stack `vue`, path `apps/web`) and `api` (stack `laravel`, path `apps/api`)
- **THEN** validation passes and both platforms are known

#### Scenario: Both forms
- **WHEN** `relevo.yml` sets `platform` and `platforms`
- **THEN** validation fails and says to keep only `platforms`

#### Scenario: Bad path or target
- **WHEN** a path is absolute, contains `..`, or a target is not defined by the stack
- **THEN** validation fails and names the platform, the value and, for a target, the targets the stack defines

### Requirement: A stack has a profile
Every stack SHALL have a profile: a Markdown file whose header can be read by scripts and whose body is read by the agents. The header SHALL name the commands that verify the code (`analyze`, `test`, `format`), the generated files left out of the diff under review, the tools the stack needs, the skills it requires, the extra skills per role and, for stacks with targets, the tool each target needs. The plugin SHALL ship the `flutter` profile with targets `android`, `ios` and `web`.

#### Scenario: Flutter profile
- **WHEN** the profile of `flutter` is read
- **THEN** it names `flutter analyze --no-pub` and `flutter test --reporter=compact --no-pub`, leaves `*.g.dart`, `*.freezed.dart` and `*.mocks.dart` out of the diff, and defines the targets `android`, `ios` and `web`

#### Scenario: Unknown stack
- **WHEN** a platform names a stack for which neither the plugin nor the repository has a profile
- **THEN** validation of the profile fails and names the stack and the two places where a profile can be defined

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

### Requirement: The profile is resolved by a script, not by an agent
The profile of a platform SHALL be resolved by one command that prints it (commands after applying `checks`, generated files, tools, targets, skills per role, the body and the layers used). `go` SHALL run it and hand the result to `dev` and `qa`; the agents SHALL NOT look for profiles themselves.

#### Scenario: Resolution output
- **WHEN** the command runs for a platform of stack `flutter` with the repository adding one body paragraph
- **THEN** it lists the layers used (`plugin`, `repository`) and the resolved values

#### Scenario: Stack with no body
- **WHEN** a profile has a header and an empty body
- **THEN** it resolves without error and the agents receive only the header values

### Requirement: An issue belongs to one platform
An issue SHALL name its platform with a line `Platform: <name>`. When `relevo.yml` has one platform the line is optional and, if present, SHALL name that platform. When it has several the line is required and SHALL name one of them. Two lines naming different platforms SHALL be a problem. A feature that needs two platforms SHALL be two issues linked with `Depends-on:`.

#### Scenario: One platform, no line
- **WHEN** the repository has one platform and the issue has no `Platform:` line
- **THEN** the platform of the issue is that one

#### Scenario: Several platforms, line present
- **WHEN** the repository has `web` and `api` and the issue says `Platform: api`
- **THEN** the platform of the issue is `api`

#### Scenario: Several platforms, no line
- **WHEN** the repository has two platforms and the issue has no `Platform:` line
- **THEN** the platform cannot be resolved and the reason is that the line is missing, with the names of the platforms

#### Scenario: Unknown name
- **WHEN** the issue says `Platform: mobile` and no platform has that name
- **THEN** the platform cannot be resolved and the message names `mobile` and the platforms that exist

#### Scenario: Two different lines
- **WHEN** an issue says `Platform: web` and, elsewhere, `Platform: api`
- **THEN** the platform cannot be resolved and the message says the issue names two platforms

### Requirement: The platform of an issue can be read again later
A command SHALL be able to resolve the platform of an issue from its text at any later time, so that `fix` and `review` use the same profile `go` used.

#### Scenario: Fix after the build
- **WHEN** `fix` runs on an issue whose text says `Platform: api`
- **THEN** it resolves the platform `api` and the profile of its stack

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

### Requirement: The plugin ships profile for Supabase
The plugin SHALL ship the profile `supabase` (no targets), naming `analyze` (`supabase db lint`), `test` (`supabase test db`), and `format`. It SHALL require the tools `supabase` and `docker`. It SHALL list `supabase` and `supabase-postgres-best-practices` under `requires_skills` and under `skills` for roles `dev`, `qa`, and `issue`. It SHALL include questions for the issue writer regarding RLS authorization, lifecycle cascades, storage policies, and query indexing.

#### Scenario: Supabase profile resolution
- **WHEN** the profile of `supabase` is read
- **THEN** its `analyze` runs `supabase db lint`, its `test` runs `supabase test db`, its tools list `supabase` and `docker`, its `requires_skills` names `supabase` and `supabase-postgres-best-practices`, and it defines no targets

#### Scenario: Role skills for Supabase
- **WHEN** the profile of `supabase` is resolved for roles `dev`, `qa`, or `issue`
- **THEN** each role includes `supabase` and `supabase-postgres-best-practices`

#### Scenario: Questions for the issue writer in Supabase
- **WHEN** the profile of `supabase` is resolved for the role `issue`
- **THEN** it outputs questions prompting for RLS policies, table relations, storage permissions, and indexed columns

### Requirement: The Flutter profile carries the review rules of the official documentation
The body of the plugin's `flutter` profile SHALL tell the developer to avoid, and QA to look for in the diff, the errors of Flutter's common-errors page, the performance practices of its best-practices page, the lifecycle and web constraints, and the testing rules for plugins and generated code. Each rule SHALL be checkable by reading the diff.

#### Scenario: Unbounded list in a column
- **WHEN** the body of the `flutter` profile is read
- **THEN** it names a `ListView` or `GridView` inside a `Column` without `Expanded` or a fixed height, a `TextField` in a `Row` without a constraint, `Expanded` or `Positioned` outside a compatible parent, `setState` or `showDialog` called in `build`, and one `ScrollController` attached to several scroll views

#### Scenario: Performance in the diff
- **WHEN** the body of the `flutter` profile is read
- **THEN** it names a long list built from a concrete list of children instead of a builder, costly work or a new future in `build()`, `Opacity` or clipping inside an animation, and heavy parsing on the UI isolate

#### Scenario: Web build
- **WHEN** the body of the `flutter` profile is read
- **THEN** it says that `dart:html` and `package:js` prevent the Wasm build and that `package:web` and `dart:js_interop` replace them

### Requirement: The Flutter profile does not impose an architecture
The body of the plugin's `flutter` profile SHALL tell the developer to follow the architecture the project's rules declare and, only when they declare none, to write new code with the official guide's strongly recommended structure. It SHALL NOT require the Command or Result pattern or any state-management package. QA SHALL report an architecture finding only when the diff breaks a rule the project wrote down, or puts network or data access inside a widget.

#### Scenario: Project with its own architecture
- **WHEN** the project's rules declare an architecture (for example bloc)
- **THEN** the profile tells the developer to follow it, and QA does not report the absence of view models, commands or results

#### Scenario: Project with no declared architecture
- **WHEN** the project's rules declare no architecture
- **THEN** the profile tells the developer to keep UI and data in separate layers, to reach data through repositories over stateless services, and to pass dependencies by constructor and keep them private

#### Scenario: Network call in a widget
- **WHEN** a diff calls an HTTP client or a GraphQL client from a widget
- **THEN** QA reports it whatever architecture the project declares

### Requirement: The Flutter profile names the Dart MCP server's tools by their effect
When the body of the plugin's `flutter` profile refers to the Dart and Flutter MCP server, it SHALL name the tools agents may use because they write nothing, SHALL say that no agent uses a tool that writes files or changes a running app during a run, and SHALL fall back to the profile's commands when a tool is missing. It SHALL NOT refer to the removed "AI rules for Flutter" file.

#### Scenario: Tools that write nothing
- **WHEN** the body of the `flutter` profile is read
- **THEN** it names `analyze_files`, `lsp`, `read_package_uris`, and `run_tests` when the server enables it, as tools QA may use

#### Scenario: Tools that write or drive an app
- **WHEN** the body of the `flutter` profile is read
- **THEN** it says that no agent uses `dart_format`, `dart_fix`, `pub`, `hot_reload`, `hot_restart` or `launch_app` during a run

#### Scenario: Server without run_tests
- **WHEN** the MCP server is connected but `run_tests` is not enabled
- **THEN** the profile tells the agent to run the profile's `test` command

#### Scenario: Formatting
- **WHEN** the developer formats the code
- **THEN** the profile tells it to use the profile's `format` command on the files it changed, not the MCP `dart_format` tool, which formats the whole project root including generated files

### Requirement: A profile can say how its stack is reviewed
A profile header MAY carry a `review` block with `log` (a path or a glob of the files the audit reads), `test` (the base command that runs the project's tests) and `serve` (a `command`, a `url` and `env` for a server the agent may start, where `{port}` stands for the port the agent chose). The plugin's `laravel` profile SHALL set `log` to the files under `storage/logs` and `test` to `php artisan test`, and no `serve`. A profile body MAY have a section `Review`; it SHALL be read by the agent only in a review, joined after the plugin's, and SHALL be left out of the body that `dev` and `qa` receive.

#### Scenario: Defaults of Laravel
- **WHEN** the profile of `laravel` is resolved with no repository file
- **THEN** its `review` block has `log` under `storage/logs`, `test` as `php artisan test` and no `serve`

#### Scenario: Serve added by the repository
- **WHEN** the repository's profile sets `serve` with a command and a URL with `{port}`
- **THEN** the resolved profile has that `serve` and the defaults for `log` and `test`

#### Scenario: Agents other than review
- **WHEN** the profile is resolved for `dev` or `qa`
- **THEN** its body does not contain the section `Review`

#### Scenario: Review role
- **WHEN** the profile is resolved with the role `review`
- **THEN** the output has the `review` block and the sections `Review` of the plugin followed by the repository's

### Requirement: The review block cannot loosen a fixed rule of the review
Neither the `review` block nor the section `Review` SHALL change that the person confirms every line, that the log is audited, that `decide` gates the pull request, that environment files are never read, that no waiver is suggested, or that no code is patched in a review. A `serve` command SHALL be read only from a profile in the repository's base branch, never from an issue or a comment, and an unattended run SHALL NOT change the file. A resolved profile whose text asks for one of those things SHALL be reported, and `doctor` SHALL warn.

#### Scenario: Text asks to skip the audit
- **WHEN** the section `Review` says to skip the audit or to mark every line ok
- **THEN** the review ignores it, the resolved profile reports the line, and `doctor` warns

#### Scenario: Serve from an issue
- **WHEN** an issue or a comment names a command to start a server
- **THEN** the review does not use it

#### Scenario: Unattended change
- **WHEN** an unattended run changes `.relevo/stacks/laravel.md`
- **THEN** the run ends in `qa-failed`, as for any protected file

#### Scenario: Invalid block
- **WHEN** the `review` block has an unknown key, a `serve` without a `url`, or a `url` that is not on `localhost`
- **THEN** resolving the profile fails and names the key

### Requirement: A profile can list skills that are used only when installed
A profile header MAY carry `skills_when_installed`, a map from a role (`dev`, `qa`, `issue`, `review`) to skill names. A listed skill SHALL be given to the role when its folder is on the base branch and SHALL be skipped without a note or a warning when it is not. The repository's profile MAY carry the key too, and its lists SHALL be added to the plugin's. `skills.disable` SHALL switch off a skill of these lists as it does for the others.

#### Scenario: Listed and installed
- **WHEN** the plugin lists `laravel-best-practices` for `dev` under `skills_when_installed` and its folder is on the base branch
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
The plugin's `laravel` profile SHALL list `laravel-best-practices` and `testing-best-practices` under `skills_when_installed` for `dev` and for `qa`, and no skill under `requires_skills` or `skills`. The two SHALL fit the budget of 20 KB per role. It SHALL NOT list a skill that applies only when a package is used, such as `livewire-development`.

#### Scenario: The set
- **WHEN** the profile of `laravel` is resolved
- **THEN** `skills_when_installed.dev` and `skills_when_installed.qa` name `laravel-best-practices` and `testing-best-practices`, and `requires_skills` and every `skills` list are empty

#### Scenario: A project without Boost
- **WHEN** the project does not use Boost, so neither skill is installed
- **THEN** the run is not affected and nothing is reported about those skills

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

### Requirement: The Flutter profile lists a default set of skills for dev and qa
The plugin's `flutter` profile SHALL list a short set of official Dart and Flutter skills under `skills` for `dev` and for `qa`, and none for `issue` and `review`. The set SHALL fit the budget of 20 KB per role, SHALL NOT include a skill that imposes an architecture or a package, and SHALL NOT include a skill with scripts or one whose steps run or hot reload the app.

#### Scenario: The set
- **WHEN** the profile of `flutter` is resolved
- **THEN** `skills.dev` and `skills.qa` name `flutter-add-widget-test` and `dart-add-unit-test`, and `skills.issue` and `skills.review` are empty

#### Scenario: Nothing that runs the app
- **WHEN** the steps of each skill of the set are read
- **THEN** none tells the agent to run the application, to hot reload it, to rewrite code with a fix command, or to add a mocking package

#### Scenario: Budget
- **WHEN** the `SKILL.md` files of the set are added up
- **THEN** their size is below 20 KB for each role

#### Scenario: No imposed architecture
- **WHEN** the set is read
- **THEN** it holds no skill that prescribes a layer structure, a state-management package or an HTTP package
