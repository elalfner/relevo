# Spec Delta: platforms

## ADDED Requirements

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
