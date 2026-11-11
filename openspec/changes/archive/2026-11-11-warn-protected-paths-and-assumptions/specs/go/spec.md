## ADDED Requirements

### Requirement: The spec check lists assumptions that nothing in the repository settles
`build-preflight.mjs --stage spec` SHALL read the assumptions of `design.md` (the ones the specification wrote and the ones copied from the issue), pick those that name something outside the repository, look for each name in the repository outside `openspec/`, drop the ones it finds, and print the rest as `assumptions` and as a line `assumed` for the hand-off. It SHALL NOT change the decision: an assumption never stops the build, because a lexical match is not reliable enough to stop one. A person who wants the build to wait turns the assumption into an open question of the issue, which sends it back before the build.

#### Scenario: A permission name is not in the repository
- **WHEN** `design.md` assumes the permission `orders.export` and no file of the repository holds it
- **THEN** the output lists it, the `assumed` line names it, and the decision is still `ok`

#### Scenario: The repository settles it
- **WHEN** the name is found in a file outside `openspec/`
- **THEN** it is not listed

#### Scenario: No assumptions
- **WHEN** `design.md` has no assumptions
- **THEN** `assumptions` is empty and `assumed` is empty

### Requirement: A script lists the shared code a build touched
`scripts/shared-code.mjs` SHALL list, from the diff of the branch against the base, the added and modified source files that are shared: a file that lives in a shared folder (a path rule) or that is imported by more than one other file of the repository that is not a test. The import graph SHALL be read from the files of the repository, with relative, alias and package imports of the languages of the stacks of Relevo; the model SHALL NOT decide what is shared. Each entry SHALL say whether the file was added or modified and why it counts. `go` SHALL put the line of the output in the hand-off as `shared_code`. Nothing SHALL be blocked and the script SHALL fail open: when it cannot read the diff it prints that it could not and exits 0.

#### Scenario: A modified component used by two screens
- **WHEN** the diff modifies `src/components/Table.vue` and two other files import it
- **THEN** it is listed as modified, used by two files

#### Scenario: A new component in a shared folder
- **WHEN** the diff adds `src/components/Badge.vue`
- **THEN** it is listed as added, with the path rule as the reason, even before anything imports it

#### Scenario: A new component of one screen
- **WHEN** the diff adds `src/views/orders/Row.vue` and only `src/views/orders/List.vue` imports it
- **THEN** it is not listed

#### Scenario: Tests and documents
- **WHEN** the diff changes a test, a document or a file of `openspec/`
- **THEN** it is not listed

#### Scenario: The diff cannot be read
- **WHEN** the base branch cannot be resolved
- **THEN** the script says so in `notes`, lists nothing and exits 0
