# Proposal

## Why

A repository with a Flutter platform and a Supabase platform in separate folders is supported since 0.2.0 (`go` builds the platform each issue names), but two things still say otherwise or leave it unfinished. `skills/init/SKILL.md` tells the person that `go` "builds only a repository with one platform for now", which is no longer true and may stop people from declaring a second platform. And the `go` workflow template installs the toolchain only for `flutter`, `laravel` and `vue`, so an issue for a `supabase` platform reaches the toolchain check with no Supabase CLI to find and ends as `toolchain_missing`.

## What Changes

- Correct the sentence of `/relevo:init` about several platforms so it matches the behaviour of `go` (the platform is the one the issue names) and the documentation.
- Add to `templates/workflows/relevo-go.yml` a setup step guarded by `needs.decide.outputs.stack == 'supabase'` that installs the Supabase CLI, next to the existing Flutter, Laravel and Vue examples. Docker is already on the runner.
- Say in `docs/stacks.md` and `docs/stacks.es.md` that the `supabase` profile expects the layout of the Supabase CLI (`supabase/config.toml`, `supabase/migrations/`), and how to bring an existing remote project into it (`supabase init`, `supabase link`, `supabase db pull`). The wording follows the Supabase documentation as read when the change is written.
- Make `/relevo:doctor` check that a workflow with a `supabase` platform has an active setup step for it, as it already does for Flutter and Laravel.

Out of scope: any change to `stacks/supabase.md`, to `deploy-supabase.yml`, or to what the agents may do with a remote Supabase project (they stay on local Docker). A profile for a schema that does not use the CLI layout stays a repository-level choice (`.relevo/stacks/<stack>.md`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `go`: the workflow output that names the platform SHALL also let the build job install the Supabase CLI when the stack is `supabase`.
- `init-doctor`: `init` SHALL describe several platforms in one repository as built per issue, and `doctor` SHALL check the setup step of a `supabase` platform.

## Impact

- **Skills and templates**: `skills/init/SKILL.md`, `templates/workflows/relevo-go.yml`.
- **Code**: the workflow check in `scripts/lib/doctor.mjs`.
- **Documentation**: `docs/stacks.md`, `docs/stacks.es.md`.
- **Tests**: `tests/skill-init-doctor.test.mjs`, `tests/doctor.test.mjs`, `tests/workflow-go.test.mjs`, and any documentation-claim test that quotes the old sentence.
- **Compatibility**: no breaking change. Repositories that already copied `relevo-go.yml` must copy it again to get the new step.
- **Decided in design.md**: `doctor` fails, like Flutter and Laravel, when the Supabase step is missing. The two projects (staging and production) get a short note in the documentation about applying or marking the baseline migration in the second one.
