# Tasks

## 1. Workflow

- [x] 1.1 Add the `requeue` job to `templates/workflows/relevo-go.yml` (needs decide and build, condition from design.md, `permissions: actions: write` only, one `gh workflow run relevo-queue.yml` step with `continue-on-error` and a warning); verify `node --test tests/workflow-go.test.mjs` passes
- [x] 1.2 Extend `tests/workflow-go.test.mjs`: the job exists with the dispatch command and condition, only it has `actions: write`, `decide` and `build` do not; verify the new tests fail on the old template and pass on the new one
- [x] 1.3 Confirm `/relevo:init` switches `runs-on` in the new job and `/relevo:doctor` still passes its runner check; verify with the existing init and doctor tests (`node --test tests/`)

## 2. Docs and release

- [x] 2.1 Update the docs that say when the queue runs (grep `queue` in `docs/*.md`) and their `.es.md` versions; verify with a grep that none claims a finished build needs the cron
- [x] 2.2 Bump the version to 0.14.3 in `plugin.json`, the `relevo-template` headers and `RELEVO_VERSION` of go and queue, and add the CHANGELOG entry; verify the version consistency tests pass
- [x] 2.3 Run the full suite (`node --test tests/`) and `openspec validate requeue-after-build --strict`; verify both are clean

## Workflow follow-up

- Commit on `dev` (check `git branch --show-current` first), then archive the change after the review.
