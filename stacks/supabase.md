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
---

# Supabase

## Verification

Run the verification commands from the platform directory: `analyze` (`supabase db lint`) and `test` (`supabase test db`). These commands require the Supabase CLI and a running Docker daemon.

Do not claim the database schema is valid, clean, or passes tests unless you ran the commands and saw the results. All tests run hermetically against local Docker containers; never point tests at a remote Supabase project.

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
