---
stack: laravel
commands:
  analyze: vendor/bin/pint --test
  test: php artisan test
  format: vendor/bin/pint
generated: ['bootstrap/cache/**', 'storage/**', '_ide_helper*.php', '.phpstorm.meta.php']
tools: [php, composer]
requires_skills: []
skills:
  dev: []
  qa: []
  issue: []
  review: []
---

# Laravel

## Verification

Run the commands of this profile from the folder of the platform: `analyze` (Pint in test mode, which reports style problems without changing a file), `test` (`php artisan test`) and `format` (Pint, which does rewrite files). They use the project's own `vendor/bin`, so the dependencies must be installed with Composer; if they are not, say so instead of installing anything new.

Do not claim the code passes style or tests unless you ran the commands and saw the result. A new project ships Pint and PHPUnit but no static analyser: when the project has PHPStan or Larastan, the repository replaces `analyze` with `platforms.<name>.checks` in `relevo.yml` (for example `vendor/bin/pint --test && vendor/bin/phpstan analyse`); do not change the profile.

The tests need a database that is available in the build. A new project uses SQLite in memory for tests (`phpunit.xml`); if the project needs MySQL or PostgreSQL in tests, say that the build must provide it and do not point the tests at a real database.

## Hygiene for the developer

- Validate every request in a Form Request or with `$request->validate()`; never trust input, and return the error shape the project already uses.
- Authorise every action that reads or changes data that belongs to someone: a policy, a gate or a scoped query. A route behind `auth` is not enough.
- Protect against mass assignment: define `$fillable` (or `$guarded` deliberately) and never pass `$request->all()` to `create` or `update`.
- Avoid N+1 queries: eager-load relations used in a loop (`with()`), and prefer `Model::preventLazyLoading()` in non-production so a miss fails in tests.
- Make migrations safe and reversible: a `down()` that undoes `up()`, no data loss on a populated table, an index for each foreign key and each column used in a `where`.
- Make queued jobs and listeners idempotent: running one twice must not charge, send or create twice; give a job a unique key or check its effect first.
- Never put a secret in code: use `config()` and `.env`, and never `env()` outside the config files.
- Wrap changes that must succeed together in a transaction (`DB::transaction`).
- Write a feature test for each scenario (HTTP in, response and database out) and a unit test for logic that has no HTTP.

## What the auditor looks for in the diff

Run on a fresh project, `analyze` fails on a style problem and `test` fails on a failing test, and both print their result as JSON when the run is not interactive. Neither fails on a mass-assignment hole or an N+1 query (a controller with both passed both commands), and nothing in them looks at authorisation, so those are for the auditor to find by reading the diff:

- **Authorisation**: a controller or route that reads or changes data with no policy, gate or ownership scope.
- **Validation**: input used before it is validated; `$request->all()` passed to a model.
- **Queries**: a query or a relation access inside a loop (N+1); a missing index for a new foreign key; raw SQL built from input.
- **Migrations**: a `down()` that does not undo `up()`; a destructive change with no plan for existing rows; a long lock on a large table.
- **Jobs**: a queued job that is not safe to run twice; a job that depends on request state that will not exist later.
- **Secrets and config**: `env()` outside `config/`; a key, token or password in code or in a migration.
- **Responses**: a changed response shape that breaks existing callers; an exception message leaking internals.
- **Generated code**: leave `bootstrap/cache/`, `storage/` and IDE helper files out of the review.

## Targets

None. A Laravel platform is the back of a feature: the front depends on it with `Depends-on:`. `review` has no adapter for a backend yet and says so.

## Questions for the issue writer

- What is the endpoint (method and path), and how does the caller authenticate?
- Who is authorised: which role or ownership rule, and what happens to someone who is not (403 or 404)?
- What are the request fields and their validation rules, and what does a validation error look like?
- What is the shape of a successful response, with every field typed and which may be null?
- What error responses can there be, and with which status code and body?
- Does it change the database? If so, is the migration reversible, and what happens to existing rows?
- Does it queue work or send something to the outside? Must it be safe to run twice?
- Which existing endpoint or model does it reuse, and what must not change for the callers of the existing ones?
