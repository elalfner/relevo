# Tasks

## 1. Supabase Stack Profile

- [x] 1.1 Create `stacks/supabase.md` with header defining commands (`analyze: supabase db lint`, `test: supabase test db`, `format: npx prettier --write supabase/`), tools (`supabase`, `docker`), `requires_skills` (`supabase`, `supabase-postgres-best-practices`), role skills for `dev`, `qa`, and `issue`, and body sections (`Verification`, `Questions for the issue writer`, `Hygiene for the developer`, `What the auditor looks for in the diff`). Verify with `tests/stack-profile.test.mjs`.
- [x] 1.2 Add tests in `tests/stack-profile.test.mjs` asserting that the `supabase` profile resolves cleanly, splits questions for the issue writer away from `dev` and `qa`, and includes both skills for each configured role. Verify with `npm test`.

## 2. Doctor and Toolchain Verifications

- [x] 2.1 Update `scripts/lib/doctor.mjs` to add `supabase` and `docker` to `TOOL_INSTALL` and `TOOL_PROBE`, and add `supabase` and `supabase-postgres-best-practices` to `SKILL_INSTALL`.
- [x] 2.2 Enhance Docker checking in `scripts/lib/doctor.mjs` to verify that the Docker daemon is responsive (`docker info`), warning with instructions to start Docker Desktop or OrbStack if the CLI is present but the engine is stopped. Verify with unit tests in `tests/doctor.test.mjs`.
- [x] 2.3 Verify `relevo doctor` reports appropriate pass/fail/warn statuses on a repository configured with a `supabase` platform.

## 3. Init Guidance

- [x] 3.1 Update `skills/init/SKILL.md` (and `scripts/init.mjs` / `scripts/lib/init-tools.mjs`) to recognize the `supabase` stack, offering `npx skills add supabase/agent-skills` as a confirmed install step and documenting Supabase MCP configuration (`claude mcp add` / Antigravity workspace config) and Docker setup in the final report.
- [x] 3.2 Add test coverage in `tests/init.test.mjs` verifying that `init` plans and handles platforms with stack `supabase`.

## 4. Templates, Documentation, and CI/CD

- [x] 4.1 Create `templates/deploy-supabase.yml` providing a ready-to-use GitHub Actions workflow for deploying migrations to Supabase Staging (on push to `dev`) and Supabase Production (on push to `main` with manual human approval).
- [x] 4.2 Document the Supabase stack in `docs/stacks.es.md` and `docs/stacks.md`, explaining the monorepo pattern (`app/` + `supabase/`), Database-as-Code workflow, dynamic `seed.sql` maintenance, and Staging/Production separation.
- [x] 4.3 Run the complete test suite (`npm test`) and verify all tests pass without regressions.
