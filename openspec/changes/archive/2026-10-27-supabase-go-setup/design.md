# Design

## Context

See proposal.md for the motivation. Today `doctor` judges the toolchain step of the go workflow with a table in `scripts/lib/doctor.mjs` (`TOOLCHAIN_ACTIONS`: stack to the action that installs it, and the name of the step in the message). The template `templates/workflows/relevo-go.yml` guards each setup step with `needs.decide.outputs.stack`. The deploy template already uses `supabase/setup-cli@v1`. The sentence about several platforms lives in `skills/init/SKILL.md` and in nothing else that scripts read.

## Goals / Non-Goals

**Goals:**
- A Supabase issue built in the cloud gets the Supabase CLI before the toolchain check, like Flutter and Laravel get theirs.
- `doctor` treats the Supabase step like the Flutter and Laravel ones.
- The documentation says what layout the profile expects and how to reach it from an existing remote project.

**Non-Goals:**
- No change to `stacks/supabase.md`, to `deploy-supabase.yml` or to how agents reach remote projects (local Docker only).
- No profile for a schema without the CLI layout; that stays a `.relevo/stacks/<stack>.md` choice of the repository.
- No automatic migration of an existing schema: the documentation describes the steps, a person runs them.

## Decisions

### Decision 1: Reuse `supabase/setup-cli` in the go template
- **Choice**: One step `if: needs.decide.outputs.stack == 'supabase'` using `supabase/setup-cli@v1`.
- **Rationale**: The deploy template already uses it, so the repository has one way to install the CLI. The version follows the deploy template.
- **Alternatives**: `npx supabase`, which downloads on every run and does not put `supabase` on the path the toolchain check reads. Rejected.

### Decision 2: `doctor` fails, not warns, like Flutter and Laravel
- **Choice**: Add `supabase` to `TOOLCHAIN_ACTIONS` with the action `supabase/setup-cli` and the step name "the Supabase step". A missing step is a failure.
- **Rationale**: Without it every cloud build for that platform stops at `toolchain_missing`, the same cost the other two stacks avoid. This closes the open point of the proposal.
- **Alternatives**: A warning, because Docker-based tests may be run only on machines. Rejected: the check already does nothing when the go workflow is not installed, so a repository that builds on machines is not judged.

### Decision 3: Correct the `init` sentence in the skill, with a test
- **Choice**: Replace the sentence in `skills/init/SKILL.md` by one that says each issue names its platform. Add an assertion in `tests/skill-init-doctor.test.mjs` that the old claim is absent.
- **Rationale**: The skill text is what the agent reads, so a test on the text is the only guard against the claim returning.

### Decision 4: Document the layout and the move, citing the Supabase guide
- **Choice**: A short section in `docs/stacks.md` and `docs/stacks.es.md`: the profile expects `supabase/config.toml` and `supabase/migrations/`; to reach it from an existing remote project run `supabase init`, `supabase link --project-ref <id>` and `supabase db pull`, then read the generated migration before committing it (it can contain statements such as `DROP EXTENSION pg_net;`). It says that `pull` marks the baseline as applied in the project it is linked to, so a second project (staging and production) needs the same baseline applied or marked by hand.
- **Rationale**: It answers the question that started this change and uses only the documented CLI flow. The wording follows the Supabase documentation as read at the time of writing and says so.

## Risks / Trade-offs

- [A copied `relevo-go.yml` lacks the new step] → `doctor` now fails for it and names the step, and `init` already tells the person to compare an older workflow.
- [`supabase/setup-cli@v1` moves] → Same exposure as the deploy template; pin changes are a project choice, as the template says for the other actions.
- [The documented flow changes upstream] → The documentation states the date it was read; it is guidance, not a behaviour of Relevo.

## Open Questions

- Whether the section on staging and production should live in `docs/stacks.md` or in the comments of `deploy-supabase.yml`. It does not change the specs or the tasks.
