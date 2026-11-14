# Design

## Context

See proposal.md for the motivation. Two facts shape the approach:

- The queue decides before the specification is written, from the issue body only (`planGo`, a pure function fed by `gather`). The tasks of an issue do not exist yet, so the only files it can compare are the ones the issue names.
- The integration with the base branch belongs to `go`, which already has `probeMerge` (a merge in memory, no tree touched), `conflictHandoff` (which conflicted files may go to the developer agent) and a `conflict` outcome class in the usage record (added by `build-preflight-gates`).

## Goals / Non-Goals

**Goals:**
- Two issues that name the same file are not built at the same time, without any new state outside the issues themselves.
- The wait is bounded and visible, and never changes the order of the queue.
- A build hands off a branch that already contains the base, or says which files conflict.

**Non-Goals:**
- Predicting the files from the tasks or from the code, or reading the pull requests of the active issues.
- Resolving conflicts in non-generated files: `review` already hands those to the developer agent, and `go` stops.

## Decisions

### D1. The files an issue names come from four places of its body
A function next to `parseIssueBody` returns the local paths of "Code pointers" and "Design reference", the `file:` inputs of "External inputs" and the `Allow-paths:` entries. A path of another repository (`owner/repo:path`) and a URL are left out. Two entries collide when they are equal, or when one is a glob that matches the other (`matchesGlob` of `protected-paths.mjs`). Two globs collide only when they are equal.
*Alternatives:* a new `Touches:` line (one more thing for the spec writer, and old issues would never be held); reading the diff of the active build (precise, but needs a second API call per issue and says nothing about queued ones).

### D2. The gate is a function of the issues, in `plan.mjs`
After the dependencies and before the capacity gate, a candidate is held when an issue that comes before it names a shared file. "Before it" is: any issue that is active, or any candidate that precedes it in the planner's own order (urgent first, then `ready_at`) and is not `blocked` or `needs-spec`. The first issue in each group is never held, so there is always one that moves. The hold is a `queue` decision with the new reason and comment kind, so `applyDecisions`, `ownedByQueue` and `requeue.mjs` need no change.
*Alternative:* make the issue `blocked` with a synthetic dependency. Rejected: `blocked` means a person-declared dependency, and the bound would then have to edit the body.

### D3. The active states are read by `gather`
`gather` already reads `ready`, `queued`, `blocked`, `building` and `built`. It also reads `in-review`, `pr-open` and `changes-requested`, so that an issue stays held until the other one is merged, as the issue asks. The new issues are passed to the planner as `active` and are not candidates.

### D4. The bound uses the timeline and a hidden marker
The comment of the wait carries a hidden marker with the file and the issue (`<!-- relevo:shared-wait ... -->`). `gather` already reads the timeline of each candidate, which has the comments and their times, so the start of the current wait is the time of the oldest marker with the same file and the same issue in an unbroken run. The planner receives it as `shared_wait_since`. Past `limits.shared_file_wait_hours` the gate lets the issue through and puts the shared files and issues in the start decision, for the hand-off.
*Alternative:* the time of the `queued` label. Rejected: the issue may have been queued for capacity first, and the bound would be counted from the wrong moment.

### D5. The integration step is a script that `go` calls before the push
A script takes the base and the branch, runs `probeMerge`, and prints `{ moved, result, files }`. When the base did not move, `go` does nothing. When the merge is clean, `go` merges it, runs the QA commands again (not the whole adversarial QA: only the gate the repository defines) and takes the failure path with the reason "failed after merging the base" if they fail. When it conflicts, the script splits the files with the globs of `integration.generated`: if all are generated, `go` runs `integration.regenerate` and finishes the merge; otherwise `go` pushes the branch without the merge and ends in `qa-failed` with the outcome `conflict` and the files in the message.
*Alternative:* hand the conflict to the developer agent, as `review` does. Rejected for the unattended run: a conflict in a file that is not generated usually means two issues changed the same logic, and a person should look at it.

### D6. Generated files are configuration, not detection
`integration.generated` is a list of globs and `integration.regenerate` the one command that regenerates them, both in `relevo.yml`; the globs are validated like `restricted_paths` (no absolute paths, no `..`) and a list of generated files needs the command. Relevo does not guess which files are generated. The command runs from the folder of the platform, like every other command of a run.
*Alternative:* a list of `{ paths, command }` entries, one command per group. Rejected: the configuration parser reads no lists of maps, and a project rarely has more than one code generator step.

## Risks / Trade-offs

- [An issue names a file only in prose, so it is never held] → Documented: the gate reads the four places; the integration step still catches the collision after the build.
- [A long chain of issues on one registry file serialises the whole queue] → `limits.shared_file_wait_hours` bounds each wait, and `queue.append_only` lets the project take the common registries out.
- [A glob in `Allow-paths:` such as `src/**` collides with everything] → Only a glob that matches the other entry counts, and the comment says which entry matched, so the spec writer can narrow it.
- [The timeline is paginated and a marker is missed] → The bound then starts later, which only lengthens the wait; the next evaluation still uses the same marker.
- [`git merge-tree --write-tree` needs git 2.38] → The probe returns `unknown`, which is treated as not clean, and the merge is attempted in the working tree.

## Migration Plan

No migration. The three settings default to values that keep today's behaviour except the gate itself, which only holds issues that name the same file. Rollback is to set `queue.append_only` to the files concerned, or to revert the release. The queue workflow template is unchanged, so installed projects need only the new package version in `RELEVO_VERSION`.

## Open Questions

- The exact wording of the comment and of the hand-off line is settled when the messages are written, in both languages.
