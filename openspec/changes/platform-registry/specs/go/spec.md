## ADDED Requirements

### Requirement: The agents are generic and the stack comes from the profile
`go` SHALL resolve the profile of the platform of the issue with the resolution command and give it to `relevo:dev` and `relevo:qa` together with the paths of the role skills. The agents SHALL NOT contain commands, file patterns or hygiene rules of one stack. The commands that verify the code and the generated files left out of the diff under review SHALL come from the profile.

#### Scenario: Flutter repository
- **WHEN** `go` builds an issue in a repository whose platform has stack `flutter`
- **THEN** the developer and QA receive the Flutter profile, QA runs its `analyze` and `test` commands, and the diff leaves out the profile's generated files

#### Scenario: Profile cannot be resolved
- **WHEN** the resolution command fails
- **THEN** `go` takes the failure path with the reason `profile not resolved` and builds nothing

### Requirement: One platform per run for now
The planner SHALL build an issue only when `relevo.yml` has exactly one platform. With more than one, it SHALL stop before claiming the issue, remove the `ready` label (as it does for a missing milestone, so the queue does not comment again at every evaluation) and comment that the choice of platform per issue is not available yet.

#### Scenario: Two platforms
- **WHEN** the labelled issue belongs to a repository with two platforms
- **THEN** no run starts, the `ready` label is removed, and the comment names the platforms and says why

### Requirement: The agents leave configuration alone
`relevo:dev` SHALL NOT edit `relevo.yml`, anything under `.relevo/` or `skills-lock.json`, and `relevo:qa` SHALL reject a diff that touches them, as it already does for `GLOSSARY.md` and `docs/adr/`.

#### Scenario: Developer edits the configuration
- **WHEN** the diff touches `relevo.yml`
- **THEN** QA rejects it citing the file, and the commit script would refuse it anyway
