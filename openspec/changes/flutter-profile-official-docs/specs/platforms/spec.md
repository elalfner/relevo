## MODIFIED Requirements

### Requirement: A stack has a profile
Every stack SHALL have a profile: a Markdown file whose header can be read by scripts and whose body is read by the agents. The header SHALL name the commands that verify the code (`analyze`, `test`, `format`), the generated files left out of the diff under review, the tools the stack needs, the skills it requires, the extra skills per role and, for stacks with targets, the tool each target needs. The plugin SHALL ship the `flutter` profile with targets `android`, `ios` and `web`.

#### Scenario: Flutter profile
- **WHEN** the profile of `flutter` is read
- **THEN** it names `flutter analyze --no-pub` and `flutter test --reporter=compact --no-pub`, leaves `*.g.dart`, `*.freezed.dart` and `*.mocks.dart` out of the diff, and defines the targets `android`, `ios` and `web`

#### Scenario: Unknown stack
- **WHEN** a platform names a stack for which neither the plugin nor the repository has a profile
- **THEN** validation of the profile fails and names the stack and the two places where a profile can be defined

## ADDED Requirements

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
