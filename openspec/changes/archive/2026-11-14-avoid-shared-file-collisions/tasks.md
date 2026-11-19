# Tasks

## 1. Settings

- [x] 1.1 `scripts/lib/config.mjs`: add `queue.append_only` (list of path globs, default empty), `integration.generated` (list of globs, default empty), `integration.regenerate` (string, default none) and `limits.shared_file_wait_hours` (int, min 1, default 24), rejecting a glob that is absolute or climbs out with `..` and `integration.generated` without `integration.regenerate`. Verify with `tests/config.test.mjs`: defaults, valid values, a missing command, a bad glob, 0 and a non-integer wait.
- [x] 1.2 `docs/configuration.md` and `docs/configuration.es.md`: the four keys with type and default, in the settings table and in a short paragraph on when to use each. Verify with `node --test tests/docs-claims.test.mjs`.

## 2. The files an issue names

- [x] 2.1 `scripts/lib/issue-parse.mjs`: add a function that returns the local paths named by "Code pointers", "Design reference", the `file:` inputs of "External inputs" and `Allow-paths:`, leaving out `owner/repo:path` and URLs, and a function that says which entries of two such lists collide (equal, or a glob matching the other with `matchesGlob` of `protected-paths.mjs`), after removing the files of `queue.append_only` and `integration.generated`. Verify with `tests/issue-parse.test.mjs`: each of the four places, an issue with none, a glob against a path, two different globs, an append-only file, a generated file.

## 3. The gate in the planner

- [x] 3.1 `scripts/lib/github.mjs`: read the issues labelled `in-review`, `pr-open` and `changes-requested` besides the states it reads today, return them as `active` and not as candidates, and set `shared_wait_since` on a candidate from the oldest hidden `relevo:shared-wait` marker of the current wait found in its timeline comments. Verify with `tests/github.test.mjs` using a fake `gh`: the extra states are read, they are never candidates, the marker of the same file and issue gives the time, a marker for another file or issue does not.
- [x] 3.2 `scripts/lib/plan.mjs`: after the dependency gate and before the capacity gate, hold an issue that collides with an active issue or with a candidate ahead of it that is not `blocked` or `needs-spec`, as a `queue` decision with the new reason, the file and the issue; let it through when `limits.shared_file_wait_hours` have passed since `shared_wait_since` and put the shared files and issues in the `start` decision. Verify with `tests/plan.test.mjs`: one test per scenario of "Gate 4", of "Append-only files do not count as shared" and of "The wait for a shared file has a bound", including that the first issue of a group is never held and that an urgent issue is compared in its own position.
- [x] 3.3 `tests/requeue.test.mjs`: an end-to-end case with a state file in which the active issue is merged and the held one becomes startable, and one in which it is still held and nothing is dispatched. Verify by running the file.

## 4. The comment

- [x] 4.1 `scripts/lib/messages.mjs`: a comment kind for the wait for a shared file, in English and Spanish, that names the file and the issue, mentions nobody and carries the hidden marker; the planner posts it once and again only when the file or the issue changes. Also the line of the hand-off message that lists the files shared after the bound. Verify with `tests/messages.test.mjs` for both languages and `tests/plan.test.mjs` for the "stays" and "reason changes" scenarios.
- [x] 4.2 `scripts/lib/next-step.mjs`: the table of next steps has an entry for the new reason of `queued`. Verify with `tests/next-step.test.mjs`, which already checks that every state and reason has an entry in both languages.

## 5. The integration before the hand-off

- [x] 5.1 Add `scripts/lib/integrate-base.mjs` and `scripts/integrate-base.mjs`: given the base and the branch, say whether the base moved, run `probeMerge`, and split the conflicted files into generated (by `integration.generated`) and others, printing `{ moved, result, generated, other }`. Verify with a new `tests/integrate-base.test.mjs` using throwaway repositories: base not moved, clean merge, a conflict in a generated file, a conflict in another file, an `unknown` probe.
- [x] 5.2 `skills/go/SKILL.md`: after QA passes and before the push, run the script; merge when clean and run the gate again; run `integration.regenerate` for generated files and finish the merge; otherwise push the branch unmerged and take the failure path with the `conflict` outcome and the files in the message; a failure after the merge says so. Verify with `tests/skill-go.test.mjs` (the skill mentions the script, each outcome and the re-run of the gate).
- [x] 5.3 `scripts/failure-comment.mjs` and `scripts/lib/messages.mjs`: the failure comment for the `conflict` outcome lists the files, and one for a gate that failed after the merge. Verify with `tests/messages.test.mjs` in both languages.

## 6. Documentation and final checks

- [x] 6.1 `docs/guide.md`, `docs/guide.es.md`, `docs/execution.md` and `docs/execution.es.md`: how the queue holds issues that name the same file, what counts as naming one, the bound, `queue.append_only`, `integration.generated`, and the integration of the base before the hand-off. Verify with `node --test tests/docs-claims.test.mjs` and by checking that the Spanish pages use the same setting names.
- [x] 6.2 Run `npm test` and `openspec validate avoid-shared-file-collisions --strict`. Verify that both pass.

## Workflow follow-up

- Update the version in `.claude-plugin/plugin.json` and the entry in `CHANGELOG.md` on `dev` when the change is released, as the repository's release rules say.
- Archive the change after the pull request is merged.
