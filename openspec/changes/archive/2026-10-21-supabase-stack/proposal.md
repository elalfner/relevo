# Proposal

## Why

Developers building frontend applications (such as Flutter, Vue, React, or plain web) frequently choose Supabase for authentication, storage, and database needs. However, managing schema migrations, Row Level Security (RLS) policies, and seed data through manual web consoles breaks the automated, verified cycle that Relevo provides. 

Introducing native Supabase stack support allows teams to practice strict "Database-as-Code" within a monorepo (`app/` + `supabase/`). Relevo agents (`dev`, `qa`, `issue`) will automatically write versioned SQL migrations, enforce RLS policies, run isolated pgTAP tests in local Docker, maintain dynamic `seed.sql` data, and guide safe CI/CD deployments to Staging and Production—fully compatible with both Claude Code and Antigravity.

## What Changes

- **Built-in `supabase` stack profile**: Ship `stacks/supabase.md` in Relevo with:
  - Verification commands: `analyze: supabase db lint`, `test: supabase test db`, and format.
  - Required tools: `supabase` CLI and `docker`.
  - Required skills: official `supabase` and `supabase-postgres-best-practices` from `supabase/agent-skills`.
  - Role assignments: assigning both skills to `dev`, `qa`, and `issue` (~17.5 KB total, fitting within Relevo's 20 KB role budget).
  - A specialized `Questions for the issue writer` section prompting for RLS permissions, lifecycle cascades (`ON DELETE`), storage buckets, and query indexes.
- **Enhanced `doctor` and `init` toolchain checks**:
  - Add `supabase` and `docker` to `TOOL_INSTALL` and `TOOL_PROBE` in `scripts/lib/doctor.mjs`.
  - Enhance the Docker check in `doctor` to verify not only CLI presence (`docker --version`), but that the Docker daemon is actually running (`docker info`), warning with clear instructions (e.g. to launch Docker Desktop or OrbStack) if stopped.
  - In `init`, detect the `supabase` platform and proactively offer installation of the official skills (`npx skills add supabase/agent-skills`), guide Docker/CLI setup (including Homebrew commands on macOS), and suggest Supabase MCP setup for interactive thinking.
- **Hermetic test isolation & Security model**:
  - Formalize that `/relevo:go` runs strictly against ephemeral, local Docker containers with zero production credentials or network access.
  - Ensure sample and mock data in `supabase/seed.sql` is maintained idempotently (`ON CONFLICT DO NOTHING`) as new entities are created.
- **Turnkey CI/CD deployment documentation and template**:
  - Provide `.github/workflows/deploy-supabase.yml` template and documentation for deploying migrations automatically to Staging (on push to `dev`) and Production (on release to `main` with GitHub Environment protection and manual human approval).
- **Dual-agent parity**: Guarantee seamless operation across Claude Code and Antigravity.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `platforms`: The plugin ships the built-in profile `supabase`, specifying verification commands (`supabase db lint`, `supabase test db`), required tools (`supabase`, `docker`), official Supabase agent skills for `dev`, `qa`, and `issue`, and dedicated questions for the issue writer.
- `init-doctor`: `doctor` probes `supabase` CLI and `docker` (checking that the Docker daemon is responsive), provides installation fixes, and `init` detects the `supabase` stack, offering skill and tool installation guidance alongside Supabase MCP setup suggestions.

## Impact

- **Code & Profiles**: Adds `stacks/supabase.md`; updates `scripts/lib/doctor.mjs` and `skills/init/SKILL.md`.
- **Workflows & Templates**: Adds template or documentation for `.github/workflows/deploy-supabase.yml`.
- **Documentation**: Updates `docs/stacks.es.md` and `docs/stacks.md` to document the Supabase stack, monorepo layout (`app/` + `supabase/`), and multi-tier environment strategy.
- **Compatibility**: No breaking changes to existing platforms (`flutter`, `vue`, `laravel`). Fully supported in Claude Code and Antigravity.
