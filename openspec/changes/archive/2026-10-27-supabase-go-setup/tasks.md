# Tasks

## 1. The go workflow installs the Supabase CLI

- [x] 1.1 Add the step guarded by `needs.decide.outputs.stack == 'supabase'` with `supabase/setup-cli@v1` to `templates/workflows/relevo-go.yml`, update the comment above the setup steps, and verify with `tests/workflow-go.test.mjs` (add an assertion that the step is active and guarded by the stack).
- [x] 1.2 Add `supabase` to the toolchain table of `scripts/lib/doctor.mjs` (action `supabase/setup-cli`, step "the Supabase step") and verify with new cases in `tests/doctor.test.mjs`: a Supabase platform with the step active passes, with the step missing or commented out fails and names the platform.

## 2. Init says what go does with several platforms

- [x] 2.1 Replace the sentence "Several platforms in one repository are written down, but `go` builds only a repository with one for now" in `skills/init/SKILL.md` by one that says each issue names its platform with `Platform:`, and verify with an assertion in `tests/skill-init-doctor.test.mjs` that the old claim is gone.
- [x] 2.2 Update the item of `scripts/lib/init.mjs` that names the toolchain of a workflow left alone to list Supabase, and verify with `tests/init.test.mjs`.

## 3. Documentation

- [x] 3.1 In `docs/stacks.md` and `docs/stacks.es.md` document the layout the `supabase` profile expects, the `supabase init`, `supabase link` and `supabase db pull` flow for an existing remote project, the review of the generated migration, and the case of a second project (staging and production). State the date the Supabase guide was read. Verify that `npm test` passes, including `tests/docs-claims.test.mjs` and `tests/readme-sync.test.mjs`.
- [x] 3.2 Add the release note under `[Unreleased]` in `CHANGELOG.md`, and say that a repository must copy `relevo-go.yml` again to get the Supabase step. Verify with `tests/changelog.test.mjs`.

## 4. Integration

- [x] 4.1 Run `npm test` and `openspec validate supabase-go-setup`, and verify both pass with no regressions.
