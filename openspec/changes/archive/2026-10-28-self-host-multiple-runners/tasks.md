# Tasks

## 1. The execution page

- [x] 1.1 Add the subsection "Several runners on one machine" to "Self-hosted runners" in `docs/execution.md`, after the paragraph that says to add runners: the table of what each runner keeps apart (workspace, `$RUNNER_TEMP`, tool cache, branch of the issue) and what they share (the home of the runner's user, package caches, the Docker daemon, the ports), the rule that the runners outnumber `limits.concurrent_agents` and why, the effective number of parallel builds, and the recommendation not to run two Supabase builds together; verify the text covers the scenarios "A person registers a second runner", "A stack that needs fixed ports" and "Limit equal to the number of runners"
- [x] 1.2 Add to the same subsection the paragraph on the limit (the gate counts `building` labels, gates of different issues do not wait for each other, so overlapping gates can exceed `limits.concurrent_agents`; with one runner they queue and it holds; a later evaluation of the queue sees the real count); verify it covers "Two issues labelled together" and that every name it uses (`limits.concurrent_agents`, `relevo:building`, `runner.labels`) exists, by running `node --test tests/docs-claims.test.mjs`
- [x] 1.3 Write the same subsection in `docs/execution.es.md` with the same heading level, order, table and links; verify the parity test in `tests/docs-claims.test.mjs` passes

## 2. The security page

- [x] 2.1 Add the sentence on runners of one user to the self-hosted paragraph of `docs/security.md` and `docs/security.es.md`, linking the new subsection; verify it covers "Several runners under one user" and `node --test tests/docs-claims.test.mjs` passes (the security test checks the names it uses)

## 3. Release notes and checks

- [x] 3.1 Add the entry under `[Unreleased]` in `CHANGELOG.md` (Added: the subsection and the sentence; Known limits: the overlap of gates can exceed `limits.concurrent_agents`, and the shared-state risks were not tried on a machine with several runners); verify `tests/changelog.test.mjs` passes
- [x] 3.2 Run `npm test` and `openspec validate --all` and verify both pass

## Workflow follow-up

- Archive the change after the pull request to `dev` is merged and the CI passes.
