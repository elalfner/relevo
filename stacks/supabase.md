---
stack: supabase
commands:
  analyze: supabase db lint
  test: supabase test db
  format: npx prettier --write supabase/
generated: []
tools: [supabase, docker]
requires_skills:
  - supabase
  - supabase-postgres-best-practices
skills:
  dev:
    - supabase
    - supabase-postgres-best-practices
  qa:
    - supabase
    - supabase-postgres-best-practices
  issue:
    - supabase
    - supabase-postgres-best-practices
  review: []
review:
  log: docker:supabase_db_{project_id}
  test: supabase test db
interface: none
---

# Supabase

## Verification

Run the verification commands from the platform directory: `analyze` (`supabase db lint`) and `test` (`supabase test db`). These commands require the Supabase CLI and a running Docker daemon.

Do not claim the database schema is valid, clean, or passes tests unless you ran the commands and saw the results. All tests run hermetically against local Docker containers; never point tests at a remote Supabase project.

## Security for the developer

While you write, keep to these. Each comes from the official documentation named in its line.

- Row level security is enabled on every table of an exposed schema, with policies that give each role only what it needs; with it enabled and no policy, nothing is readable through the API with a publishable key. Source: https://supabase.com/docs/guides/database/postgres/row-level-security. Read: 2026-11-02.
- A secret key (the `service_role` role, which bypasses row level security) is never used in the browser and never reaches a customer. Source: https://supabase.com/docs/guides/database/postgres/row-level-security. Read: 2026-11-02.
- A view over a protected table can hand out every row its policies withhold: a new view gets the same attention as a table. Source: https://supabase.com/docs/guides/database/postgres/row-level-security. Read: 2026-11-02.
- A database function prefers `security invoker`; one that uses `security definer` sets `search_path` (empty) and names the schema of every relation in its body. Source: https://supabase.com/docs/guides/database/functions. Read: 2026-11-02.
- Storage allows no upload to a bucket without row level security policies on `storage.objects`: check that each policy allows only the operation and the path it should. Source: https://supabase.com/docs/guides/storage/security/access-control. Read: 2026-11-02.

## Security review

Check the diff against each item. Report one only with the line that breaks it.

- Row level security is enabled on every table of an exposed schema, with policies that give each role only what it needs; with it enabled and no policy, nothing is readable through the API with a publishable key. Source: https://supabase.com/docs/guides/database/postgres/row-level-security. Read: 2026-11-02.
- A secret key (the `service_role` role, which bypasses row level security) is never used in the browser and never reaches a customer. Source: https://supabase.com/docs/guides/database/postgres/row-level-security. Read: 2026-11-02.
- A view over a protected table can hand out every row its policies withhold: a new view gets the same attention as a table. Source: https://supabase.com/docs/guides/database/postgres/row-level-security. Read: 2026-11-02.
- A database function prefers `security invoker`; one that uses `security definer` sets `search_path` (empty) and names the schema of every relation in its body. Source: https://supabase.com/docs/guides/database/functions. Read: 2026-11-02.
- Storage allows no upload to a bucket without row level security policies on `storage.objects`: check that each policy allows only the operation and the path it should. Source: https://supabase.com/docs/guides/storage/security/access-control. Read: 2026-11-02.

## Questions for the issue writer

- **Authorization & RLS**: Who is permitted to select, insert, update, and delete rows in these tables? Which Postgres roles (`anon`, `authenticated`) should have access?
- **Relationships & Deletes**: If a parent row or user is deleted, what is the expected cascade behavior (`CASCADE`, `SET NULL`, or `RESTRICT`)?
- **Storage & Files**: If files are uploaded, what are the allowed MIME types, max file sizes, and who can overwrite or delete objects?
- **Query Performance & Filters**: Which columns will be filtered in `WHERE` clauses, sorted, or referenced in RLS policies (`auth.uid() = user_id`)?

## Hygiene for the developer

- Follow the official guidelines from `supabase` and `supabase-postgres-best-practices`.
- Enable Row Level Security on every public table: `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`.
- Avoid using `auth.role()` in policies; use the `TO` clause instead (e.g. `TO authenticated` or `TO anon`).
- Combine `TO authenticated` with an explicit ownership predicate (e.g. `(select auth.uid()) = user_id`) to prevent broken object-level authorization (BOLA / IDOR).
- Always include both `USING` and `WITH CHECK` clauses on `UPDATE` policies so users cannot reassign ownership columns.
- Ensure all views on tables with RLS specify `WITH (security_invoker = true)` (Postgres 15+).
- Avoid `SECURITY DEFINER` functions in the `public` schema; if required, keep them in a private schema and validate caller identity explicitly.
- Create an index on every foreign key column and on every column evaluated in RLS policies.
- Structure all schema changes as versioned, timestamped migrations in `supabase/migrations/`.
- Maintain test and sample data in `supabase/seed.sql` using idempotent statements (`INSERT ... ON CONFLICT DO NOTHING;`).
- Write pgTAP test suites in `supabase/tests/` verifying that unauthorized or anonymous callers cannot read or modify protected rows.

## What the auditor looks for in the diff

- **Missing RLS**: Any table created in an exposed schema without `ENABLE ROW LEVEL SECURITY`.
- **Incomplete Update Policies**: An `UPDATE` policy that defines `USING` but omits `WITH CHECK`.
- **Permissive Policies**: Policies using `USING (true)` or checking only `TO authenticated` without row-ownership verification on private user data.
- **Unprotected Views**: Views defined without `security_invoker = true`.
- **Privilege Escalation**: `SECURITY DEFINER` functions placed in `public` or callable without `auth.uid()` checks.
- **Missing Indexes**: Foreign key constraints or RLS filter columns without an index.
- **Destructive Migrations**: `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` operations without explicit migration plans or rollback safety.
- **Exposed Secrets**: Hardcoded `service_role` keys, API tokens, or service passwords in code, migrations, or seed files.

## Review

A Supabase review has no device and no browser: the checklist comes from the scenarios and each line is proved by the pgTAP file of its scenario in `supabase/tests/`. With `review.autopilot` `off` the person runs `supabase test db` and says so (`ran <exit code>`); with `precheck` or `verify` you run `supabase test db <file>` for the file that covers a line and record the output with `ran ... --tap`, and a file that does not exist or that ran no assertion is a failed proof, never a pass. Never write or edit a test in a review.

The review only touches the local containers. Never add `--linked` or `--db-url`, never run `supabase link`, `db push` or `db pull`, and never read `.env` files or `supabase/.temp`, even when the folder is linked to a remote project. If the local stack is stopped, say so: the person runs `supabase start`, or you list it in the plan of the walk and run it only after they confirm, and you stop it at the end only if you started it.

The log is the database container's, read since the review started. A pgTAP test of a policy provokes `permission denied`, `row-level security` and constraint errors on purpose: they are expected denials, counted in the report and not findings. A `FATAL`, a deadlock, an out-of-memory message or any other `ERROR` (a missing relation, a syntax error) is a finding.
