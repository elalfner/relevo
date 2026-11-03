# Spec Delta

## MODIFIED Requirements

### Requirement: A profile can say how its stack is reviewed
A profile header MAY carry a `review` block with `log` (a path or a glob of the files the audit reads, or `docker:<container>` for the log of a container), `test` (the base command that runs the project's tests) and `serve` (a `command`, a `url` and `env` for a server the agent may start, where `{port}` stands for the port the agent chose). In a `docker:` name `{project_id}` stands for the `project_id` of `supabase/config.toml`. The plugin's `laravel` profile SHALL set `log` to the files under `storage/logs` and `test` to `php artisan test`, and no `serve`. The plugin's `supabase` profile SHALL set `log` to `docker:supabase_db_{project_id}` and `test` to `supabase test db`, and no `serve`. A `test` that names `--linked` or `--db-url` SHALL be invalid. A profile body MAY have a section `Review`; it SHALL be read by the agent only in a review, joined after the plugin's, and SHALL be left out of the body that `dev` and `qa` receive.

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

#### Scenario: Agents other than review
- **WHEN** the profile is resolved for `dev` or `qa`
- **THEN** its body does not contain the section `Review`

#### Scenario: Review role
- **WHEN** the profile is resolved with the role `review`
- **THEN** the output has the `review` block and the sections `Review` of the plugin followed by the repository's
