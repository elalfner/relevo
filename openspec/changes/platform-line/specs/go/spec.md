## ADDED Requirements

### Requirement: The gate resolves the platform of the issue
Before claiming an issue, the planner SHALL resolve its platform. When it cannot (a missing `Platform:` line with several platforms, an unknown name, two different lines) the issue SHALL go to `needs-spec` with the reason `missing`, the specification writer SHALL be assigned, and the comment SHALL say which of the three it is and list the platforms. When it can, the `start` decision SHALL carry `platform`, `stack`, `path` and `targets`.

#### Scenario: Platform resolved
- **WHEN** a ready issue says `Platform: web` and `web` has stack `vue` at `apps/web`
- **THEN** the decision is `start` and carries `platform` `web`, `stack` `vue`, `path` `apps/web`

#### Scenario: Several platforms and no line
- **WHEN** a ready issue has no `Platform:` line and the repository has two platforms
- **THEN** the decision is `needs-spec`, the comment names both platforms and says to add the line, and no run starts

#### Scenario: One platform and no line
- **WHEN** a ready issue has no `Platform:` line and the repository has one platform
- **THEN** the decision is `start` and carries that platform

### Requirement: An issue changes only its platform
A commit of an unattended run SHALL touch only files inside the folder of the platform of the issue, the change's own specification folder, `GLOSSARY.md` and `docs/adr/`. Any other path SHALL end the run in `qa-failed` with the reason "outside the platform", and nothing is pushed, unless the issue lists the path in an `Allow-paths:` line. A platform whose folder is `.` is not restricted.

#### Scenario: Front issue touches the back
- **WHEN** the diff of an issue for `web` (`apps/web`) touches `apps/api/app/User.php`
- **THEN** the commit is refused as outside the platform

#### Scenario: Shared package authorized
- **WHEN** the issue says `Allow-paths: packages/shared/**` and the diff touches `packages/shared/a.ts`
- **THEN** the commit is accepted

#### Scenario: Whole repository platform
- **WHEN** the platform folder is `.`
- **THEN** no path is refused for being outside it

### Requirement: Commands run from the folder of the platform
`go` SHALL resolve the profile and the role skills for the platform of the decision and tell `relevo:dev` and `relevo:qa` the folder of the platform, from which the commands of the profile are run.

#### Scenario: Monorepo
- **WHEN** `go` builds an issue for `api` at `apps/api`
- **THEN** the agents receive the profile of the stack of `api` and the folder `apps/api`

### Requirement: The workflow output names the platform
`go-plan.mjs` SHALL write `platform`, `stack` and `path` to the workflow output next to the action, so that the build job installs only the toolchain of that stack.

#### Scenario: Output for a start
- **WHEN** the decision is `start` for a Vue platform
- **THEN** the output has `stack=vue`, and a setup step guarded by that value runs while the Flutter one does not

## REMOVED Requirements

### Requirement: One platform per run for now
**Reason**: the `Platform:` line says which platform an issue belongs to, so a repository with several platforms can be built.
**Migration**: add `Platform: <name>` to the issues of a repository with several platforms; with one platform nothing changes.
