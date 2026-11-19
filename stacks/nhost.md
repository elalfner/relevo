---
stack: nhost
commands:
  analyze: npm run --silent analyze
  test: npm run --silent test
generated: []
tools: [docker, node]
skills:
  dev: []
  qa: []
  issue: []
  review: []
review:
  log: 'compose:'
  test: npm run --silent test
interface: none
---

# Nhost

## Verification

Run the verification commands from the platform directory: `analyze` and `test` are npm scripts of the backend. `test` needs the local instance (Postgres, Hasura, Auth and the functions service, in the containers of one Docker Compose project) to be up, and the person starts it.

Do not claim the backend is valid, clean, or passes tests unless you ran the commands and saw the results. The tests leave data in the local instance; never point them at a remote project.

## Security for the developer

While you write, keep to these. Each comes from the official documentation named in its line.

- Every exposed table has explicit permissions for each role that needs it, and a role gets only the operations and columns it needs. Source: https://hasura.io/docs/2.0/auth/authorization/permissions/. Read: 2026-11-19.
- The built-in `admin` role can perform any operation on any table, so no account or client is given it. Source: https://hasura.io/docs/2.0/auth/authorization/roles-variables/. Read: 2026-11-19.
- The admin secret keeps the GraphQL endpoint and the console from being public: it stays in the tools and the server, never in client code, a migration or a seed file. Source: https://hasura.io/docs/2.0/deployment/securing-graphql-endpoint/. Read: 2026-11-19.

## Security review

Check the diff against each item. Report one only with the line that breaks it.

- Every exposed table has explicit permissions for each role that needs it, and a role gets only the operations and columns it needs. Source: https://hasura.io/docs/2.0/auth/authorization/permissions/. Read: 2026-11-19.
- The built-in `admin` role can perform any operation on any table, so no account or client is given it. Source: https://hasura.io/docs/2.0/auth/authorization/roles-variables/. Read: 2026-11-19.
- The admin secret keeps the GraphQL endpoint and the console from being public: it stays in the tools and the server, never in client code, a migration or a seed file. Source: https://hasura.io/docs/2.0/deployment/securing-graphql-endpoint/. Read: 2026-11-19.

## Questions for the issue writer

- **Authorization**: Which roles may select, insert, update and delete each table, and which columns may each of them see?
- **Volume & Growth**: How many rows will each table hold after a year, and does a screen read all of them? A table that can grow gets a limit or a range in every query that reads it.

## Review

A Nhost review has no device and no browser: the checklist comes from the scenarios and the project's tests run once, against the local instance, with the command of `review.test`. The person starts the instance and says it is up; you never start or stop it, never add a remote address to a command and never read `.env` files. The tests leave data in the local instance, and a full run is not repeated in a loop: some services limit sign-ins.

The log is the containers' log, read since the review started. A permission or constraint error that a test provokes on purpose is an expected denial; a `FATAL`, a deadlock, an out-of-memory message, a database error that is not a denial or a server error is a finding.
