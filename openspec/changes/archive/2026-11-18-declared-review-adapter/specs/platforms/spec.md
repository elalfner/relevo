# Spec Delta

## MODIFIED Requirements

### Requirement: A profile can say how its stack is reviewed
A profile header MAY carry a `review` block with `log` (a path or a glob of the files the audit reads, `docker:<container>` for the log of a container, or `compose:<services>` for the log of services of a Docker Compose project, every service when none is named), `test` (the base command that runs the project's tests; in a repository profile that declares an adapter it MAY contain `{filter}`) and `serve` (a `command`, a `url` and `env` for a server the agent may start, where `{port}` stands for the port the agent chose). In a `docker:` name `{project_id}` stands for the `project_id` of `supabase/config.toml`. The plugin's `laravel` profile SHALL set `log` to the files under `storage/logs` and `test` to `php artisan test`, and no `serve`. The plugin's `supabase` profile SHALL set `log` to `docker:supabase_db_{project_id}` and `test` to `supabase test db`, and no `serve`. A `test` that names `--linked` or `--db-url` SHALL be invalid. A profile body MAY have a section `Review`; it SHALL be read by the agent only in a review, joined after the plugin's, and SHALL be left out of the body that `dev` and `qa` receive.

#### Scenario: Defaults of Laravel
- **WHEN** the profile of `laravel` is resolved with no repository file
- **THEN** its `review` block has `log` under `storage/logs`, `test` as `php artisan test` and no `serve`

#### Scenario: Defaults of Supabase
- **WHEN** the profile of `supabase` is resolved with no repository file
- **THEN** its `review` block has `log` as `docker:supabase_db_{project_id}`, `test` as `supabase test db` and no `serve`

#### Scenario: Serve added by the repository
- **WHEN** the repository's profile sets `serve` with a command and a URL with `{port}`
- **THEN** the resolved profile has that `serve` and the defaults for `log` and `test`

#### Scenario: Remote database in test
- **WHEN** the repository's profile sets `review.test` to `supabase test db --db-url postgres://...`
- **THEN** resolving the profile fails and names `review.test`

#### Scenario: Log of Compose services
- **WHEN** a repository profile sets `review.log` to `compose:postgres,auth`
- **THEN** the resolved profile has that `log`

#### Scenario: Compose log with a bad name
- **WHEN** a profile sets `review.log` to `compose:postgres;rm`
- **THEN** resolving the profile fails and names `review.log`

#### Scenario: Agents other than review
- **WHEN** the profile is resolved for `dev` or `qa`
- **THEN** its body does not contain the section `Review`

#### Scenario: Review role
- **WHEN** the profile is resolved with the role `review`
- **THEN** the output has the `review` block and the sections `Review` of the plugin followed by the repository's

## ADDED Requirements

### Requirement: A repository profile can declare the api review adapter of its own stack
The `review` block of a repository profile MAY carry `adapter` (only `api`, which requires `log` and `test`) and `needs` (a list of tool names, never a path). A declaration on a stack that defines targets, any other value, a `needs` that is not a list of names, and `adapter` or `needs` in a profile of the plugin SHALL be invalid, and resolving the profile SHALL fail naming the key.

#### Scenario: Declared in a repository-only stack
- **WHEN** no plugin profile exists for the stack and the repository's profile sets `review.adapter: api` with `log`, `test` and `needs`
- **THEN** the resolved profile carries all four

#### Scenario: Missing log or test
- **WHEN** a profile sets `adapter: api` without `log` or without `test`
- **THEN** resolving the profile fails and names the missing key

#### Scenario: Another kind
- **WHEN** a profile sets `review.adapter: browser` or `review.adapter: device`
- **THEN** resolving the profile fails, names `review.adapter` and says that `api` is the only value

#### Scenario: Needs that is not a list
- **WHEN** a profile sets `review.needs: docker`
- **THEN** resolving the profile fails and says that `review.needs` is a list of tool names

#### Scenario: Needs with a path
- **WHEN** a profile sets `review.needs: ["./tools/run"]`
- **THEN** resolving the profile fails and names `review.needs`

#### Scenario: A stack with targets
- **WHEN** the profile of a stack that defines `targets` sets `review.adapter: api`
- **THEN** resolving the profile fails and says that a declared adapter is for a stack with no targets

#### Scenario: Declared in a profile of the plugin
- **WHEN** a profile of the plugin sets `review.adapter`
- **THEN** resolving it fails and says that the declaration belongs in the repository's profile

### Requirement: A repository profile cannot change the adapter of a shipped stack
When the plugin has a profile for the stack (`flutter`, `vue`, `laravel`, `supabase`), the `adapter` and `needs` of the repository's `review` block SHALL be ignored and reported as ignored, with the adapter the plugin keeps, so that the repository cannot change how a shipped stack is reviewed. The other keys of the block keep their rule: a key the repository writes replaces the plugin's.

#### Scenario: Ignored for a shipped stack
- **WHEN** the repository's `.relevo/stacks/supabase.md` sets `review.adapter: api` and `review.needs: [docker]`
- **THEN** the resolved profile keeps the plugin's adapter, has no `adapter` or `needs` of the repository and lists both as ignored

#### Scenario: Other keys still replace
- **WHEN** the repository's `.relevo/stacks/laravel.md` sets `review.adapter: api` and `review.test: php artisan test --parallel`
- **THEN** `review.test` is the repository's, the declaration is reported as ignored and the review uses the plugin's adapter of Laravel

### Requirement: The commands of a declared adapter reach only what is local
For a declared adapter, `review.test` and `review.log` SHALL be invalid when they name a remote target: `--linked`, `--db-url`, `link`, `push` or `pull`, or an address of the form `scheme://host` whose host is not `localhost`, `127.0.0.1` or `[::1]`, or whose host the text does not spell out (for example a variable). A name that does not look like an address is not read, so the check is a tripwire; the person's written confirmation about the data is the guard.

#### Scenario: Remote address in the test
- **WHEN** `review.test` of a declared adapter contains `https://api.example.com`
- **THEN** resolving the profile fails and names `review.test`

#### Scenario: Local address in the test
- **WHEN** `review.test` of a declared adapter contains `http://127.0.0.1:8080`
- **THEN** resolving the profile succeeds

#### Scenario: Address with a variable host
- **WHEN** `review.test` of a declared adapter contains `https://$HOST/graphql`
- **THEN** resolving the profile fails and names `review.test`

#### Scenario: Remote flag
- **WHEN** `review.test` of a declared adapter contains `--db-url`
- **THEN** resolving the profile fails and names `review.test`
