# Design

## Context

Relevo currently ships out-of-the-box stack profiles for `flutter`, `vue`, and `laravel`. The `platforms` specification decouples stack knowledge from the agents: `dev` and `qa` are generic runners that receive a resolved profile containing verification commands (`analyze`, `test`, `format`), tools, role-specific skills, and hygiene guidelines.

When building applications backed by Supabase (such as a Flutter mobile app, Vue frontend, or React web app), developers need database schema changes, Row Level Security (RLS) policies, and test seed data to be version-controlled, tested, and audited automatically without requiring manual dashboard clicks.

## Goals / Non-Goals

**Goals:**
- Provide a first-class built-in profile `stacks/supabase.md` in Relevo.
- Support a clean monorepo architecture where a backend platform (`supabase/`) and frontend platform (`app/`) communicate via `Depends-on:` issues.
- Leverage the official `supabase/agent-skills` (`supabase` and `supabase-postgres-best-practices`) across `dev`, `qa`, and `issue`.
- Ensure 100% hermetic test isolation during `/relevo:go` using local/runner Docker containers.
- Enhance `doctor` to verify `supabase` CLI and verify that the Docker daemon is actually running (`docker info`).
- Provide `init` assistance for installing skills, configuring Supabase MCP, and setting up Docker/CLI.
- Define a turn-key CI/CD deployment workflow template (`deploy-supabase.yml`) for Staging (`dev`) and Production (`main`).
- Maintain seamless parity across both Claude Code and Antigravity.

**Non-Goals:**
- Allowing `/relevo:go` or agents to connect directly to remote Supabase Cloud instances (cloud access is strictly isolated; `go` uses local Docker).
- Replacing the official Supabase CLI with custom abstractions.
- Supporting legacy Postgres setups without Supabase CLI.

## Decisions

### Decision 1: Ship `stacks/supabase.md` as a built-in profile
- **Choice**: Include `stacks/supabase.md` directly in the Relevo plugin distribution rather than requiring every repository to hand-craft `.relevo/stacks/supabase.md`.
- **Rationale**: Elevates Supabase to a supported first-class citizen alongside Flutter, Vue, and Laravel. Repositories can still extend it via `.relevo/stacks/supabase.md` if needed.
- **Alternatives considered**: Requiring repositories to write custom `.relevo/stacks/` profiles. Rejected because Supabase CLI conventions (`supabase db lint`, `supabase test db`) are standard across the ecosystem.

### Decision 2: Assign official Supabase skills to `dev`, `qa`, and `issue`
- **Choice**: List `supabase` and `supabase-postgres-best-practices` under `requires_skills` and assign both to `dev`, `qa`, and `issue`.
- **Rationale**:
  - `supabase` (14.3 KB) covers platform features, CLI gotchas, and security rules (e.g. `WITH CHECK` on update policies, `security_invoker` on views, storage upserts).
  - `supabase-postgres-best-practices` (3.2 KB) covers indexing, foreign keys, and query optimization.
  - Combined size (~17.5 KB) is within Relevo's 20 KB role budget (`SIZE_BUDGET_BYTES` in `role-skills.mjs`).
  - `dev` implements safe migrations; `qa` acts as an adversarial auditor catching subtle RLS/indexing holes; `issue` formulates complete schema requirements before coding starts.
- **Alternatives considered**: Allocating only `postgres-best-practices` to `dev`/`qa` and only `supabase` to `issue`. Rejected because `dev` and `qa` both need Supabase-specific authorization checklists to write and review secure RLS.

### Decision 3: Hermetic test isolation in Docker during `go`
- **Choice**: `test: supabase test db` executes against local Postgres running in Docker. Database state is ephemeral and never persisted across runs.
- **Rationale**: Guarantees deterministic, clean-slate testing. Each `go` execution starts with a fresh container, executes all migrations from scratch, and verifies schema consistency without risk of dirty test data.
- **Alternatives considered**: Sharing a persistent cloud staging database during `go`. Rejected because concurrent runs would collide, failed experiments would pollute staging, and network tokens would be exposed to the build runner.

### Decision 4: Dynamic, idempotent seed data in `supabase/seed.sql`
- **Choice**: Instruct `dev` to populate `supabase/seed.sql` with mock data for new entities using idempotent `INSERT ... ON CONFLICT DO NOTHING;` syntax.
- **Rationale**: When frontend issues are built, the local Docker environment is already seeded with realistic sample data, enabling interactive testing and UI development without manual database setup.

### Decision 5: Three-tier environment model and GitHub Actions CI/CD
- **Choice**: Structure deployments across three explicit boundaries:
  1. *Feature branches* (`feature/*`): 100% local Docker via Relevo `go`.
  2. *Base branch* (`dev`): Merges via `/relevo:ship` trigger automatic deployment to a Supabase Staging project (`supabase link --project-ref $STAGING_REF && supabase db push`).
  3. *Release branch* (`main`): Promotion to `main` deploys to Supabase Production under GitHub Environment protection with required human approval.
- **Rationale**: Keeps production completely isolated from unsupervised agent runs. Humans review and approve before any code reaches staging, and explicitly approve before production release.

### Decision 6: Docker daemon health check in `doctor`
- **Choice**: When probing `docker` for a Supabase platform, `doctor` executes `docker info` in addition to checking CLI presence.
- **Rationale**: A common developer failure mode is having the `docker` binary installed while the Docker engine/daemon (Docker Desktop, OrbStack, or dockerd) is stopped. Checking `docker info` enables `doctor` to provide actionable guidance ("Docker is installed but the engine is stopped. Start Docker Desktop or OrbStack").

## Risks / Trade-offs

- **[Docker required in development environment]** → Mitigation: `init` and `doctor` provide clear, platform-appropriate installation commands (e.g. `brew install --cask docker` or `brew install orbstack` on macOS). GitHub Actions runners (`ubuntu-latest`) have Docker pre-installed.
- **[Token size approaching 20 KB limit]** → Mitigation: The two skills together measure 17.5 KB. `doctor` monitors role skill budgets and warns if future upstream updates exceed 20 KB.
- **[Docker startup latency in tests]** → Mitigation: `supabase test db` takes ~15–30s to initialize containers; this is well within typical CI turn limits and ensures complete hermetic validation.

## Migration Plan

- Greenfield addition. Existing platforms (`flutter`, `vue`, `laravel`) remain untouched.
- Repositories adopting Supabase add a platform entry in `relevo.yml` (e.g., `backend: { stack: supabase, path: supabase }`) and run `/relevo:init` or `relevo doctor` to verify tools and skills.
