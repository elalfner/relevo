## ADDED Requirements

### Requirement: Gate 4, files shared with another issue
`go` SHALL NOT start an issue that names a file which an earlier issue also names, while that issue is active (`building`, `built`, `in-review`, `pr-open` or `changes-requested`) or is ahead of it in the queue. The files an issue names are the local paths of its "Code pointers" and "Design reference", the `file:` inputs of "External inputs" and the entries of `Allow-paths:`. The gate comes after the dependencies and before the limits.

#### Scenario: Two issues name the same registry file
- **WHEN** issue 12 is `building` and issue 15, which is eligible, names the same router file
- **THEN** issue 15 is labelled `queued`, one comment names the file and issue 12 and mentions nobody, and no build starts for it

#### Scenario: The first issue merges
- **WHEN** issue 12 is merged and issue 15 was waiting only for the shared file
- **THEN** the queue evaluates it and, if every other gate passes, issue 15 starts

#### Scenario: The first issue is still ahead in the queue
- **WHEN** issues 12 and 15 both wait and name the same file
- **THEN** only the one whose `ready` label is older may start, and the other waits for it to be merged

#### Scenario: An issue that names no file
- **WHEN** an issue has no path in any of those places
- **THEN** this gate never holds it

#### Scenario: A blocked issue ahead does not hold the line
- **WHEN** the older issue is `blocked` by a dependency and the newer one names the same file
- **THEN** the newer one starts, because the older one is not active and will pass the gate again when it can start

### Requirement: Append-only files do not count as shared
A file that matches an entry of `queue.append_only` SHALL NOT make two issues wait for each other, because a merge of added lines is trivial. A generated file named in `integration.generated` SHALL NOT either, because the integration step regenerates it.

#### Scenario: A shared append-only list
- **WHEN** two issues name only `src/nav/items.ts`, and `queue.append_only` lists it
- **THEN** both are eligible and start as the limits allow

#### Scenario: A shared generated file
- **WHEN** two issues name only `src/gql/types.ts`, and `integration.generated` lists it
- **THEN** both are eligible, and the integration step of the second one regenerates the file if the merge conflicts

#### Scenario: Only files outside both lists are compared
- **WHEN** two issues name `router.ts` and `src/nav/items.ts`, and `src/nav/items.ts` is in `queue.append_only`
- **THEN** the issues share only `router.ts`, and the comment names it

### Requirement: The wait for a shared file has a bound
An issue SHALL wait for a shared file for at most `limits.shared_file_wait_hours`, counted from the first evaluation that held it for that reason. When the time passes, the issue SHALL start when the other gates allow it, and its hand-off message SHALL list the shared files and the issues that shared them.

#### Scenario: The first issue takes too long
- **WHEN** issue 15 has waited `limits.shared_file_wait_hours` for issue 12 to be merged and a slot is free
- **THEN** issue 15 starts, and its hand-off says it shares `router.ts` with issue 12

#### Scenario: The bound is not a dependency
- **WHEN** an issue's wait for a shared file ends because of the bound
- **THEN** its labels and its place in the queue are those of any other eligible issue, and nothing records a dependency

#### Scenario: The wait restarts
- **WHEN** an issue stops waiting because the other issue was merged and later waits for a different file of another issue
- **THEN** the bound is counted again from the first evaluation of that new wait

### Requirement: The base branch is integrated before the hand-off
After QA passes and before it pushes the branch, `go` SHALL check whether the base branch moved. When it did and the merge has no conflict, `go` SHALL merge the base branch, run the gate again and hand off only if it passes. A conflict in a generated file SHALL be resolved by regenerating it with the command in `integration.generated`; a conflict in any other file ends in the `conflict` outcome with the files named.

#### Scenario: The base moved without a conflict
- **WHEN** QA passes and the base branch has new commits that merge cleanly
- **THEN** the base is merged, the gate runs again, and the issue is `built` with the merged branch pushed

#### Scenario: The merged branch fails the gate
- **WHEN** the gate fails after the merge
- **THEN** the run takes the failure path of a rejected build, and the message says the failure came after merging the base

#### Scenario: A generated file conflicts
- **WHEN** the merge conflicts only in files that `integration.generated` lists
- **THEN** each one is regenerated with its command, the merge is completed and the gate runs again

#### Scenario: Another file conflicts
- **WHEN** the merge conflicts in a file that is not generated
- **THEN** the branch is pushed without the merge, the issue goes to `qa-failed` with the outcome `conflict`, and the message lists the conflicted files

#### Scenario: The merge cannot be probed
- **WHEN** the installed git cannot probe the merge
- **THEN** the result is treated as unknown, not as clean, and the merge is attempted in the working tree with the same outcomes

#### Scenario: The base did not move
- **WHEN** the base branch has no new commits since the build started
- **THEN** nothing is merged and the hand-off is the usual one
