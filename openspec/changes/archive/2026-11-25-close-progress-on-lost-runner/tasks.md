# Tasks

## 1. The closing step

- [x] 1.1 In `templates/workflows/relevo-go.yml`, add to the `requeue` job a step `Close the progress comment of a build that ended without closing it`, after `Return a build that no runner took to the queue` and before `Start the queue`: `continue-on-error: true`, `BUILD_RESULT: ${{ needs.build.result }}` and the run URL as inputs; it exits at once unless the result is `failure` or `cancelled`; it patches the last open progress comment of the bot (open means without the closed marker) with the line in the language of `relevo.yml` plus both markers. Verify with `node --test tests/workflow-go.test.mjs`.
- [x] 1.2 Extend the fake-`gh` harness of `tests/workflow-go.test.mjs` and add a test per scenario of the delta: a failed build with an open comment is closed with the line and the run link; the Spanish line when `relevo.yml` says `es`; an already closed comment, no comment and a `success` are left untouched; a `cancelled` build with the waiting marker still gets the line of `No runner took` and one comment only; the labels and the number of comments do not change; the step comes before `Start the queue` and is `continue-on-error`. Verify with `node --test tests/workflow-go.test.mjs`.
- [x] 1.3 Check that the template still passes the tests that read it (`tests/workflow-pins.test.mjs`, `tests/workflow-progress.test.mjs`, `tests/doctor.test.mjs`) and that `buildTimeoutMinutes` still reads the `build` job: `npm test`.

## 2. Documentation

- [x] 2.1 In `docs/execution.md` and `docs/execution.es.md`, under `## When a run stops without a result`, add the case of a lost runner: the comment is closed by the `requeue` job with a line that links the run, the issue stays `building`, and `status` raises the alert for a build with no activity. Verify that both files have the same sections and that `npm test` passes.
- [x] 2.2 Add an entry under `[Unreleased]` in `CHANGELOG.md`, in neutral words (no project, issue or runner names): the progress comment is no longer left as "in progress" when the runner of a build is lost. Verify with `openspec validate close-progress-on-lost-runner` and `npm test`.

## 3. Integration check

- [x] 3.1 In the sandbox, stop the runner of a build in progress (for example by stopping the runner service) and verify that the progress comment ends closed with the new line once the build job ends as failed, and that the issue keeps its labels; record it in `docs/pilot-findings.md` with neutral names.

## Workflow follow-up

- Run `npm test` and `openspec validate --all` before pushing, then archive the change after the pull request is merged.
