## ADDED Requirements

### Requirement: Doctor explains an unreadable linked repository
For each repository in `links` that cannot be read, `doctor` SHALL name the repository and say what to grant: read access to issues, pull requests and contents through the secret `RELEVO_LINKS_TOKEN`, or copying the file it needs into this repository. For a private linked repository whose secret exists, `doctor` SHALL say that it cannot verify what the token covers, and SHALL NOT read the value of the secret.

#### Scenario: Linked repository not readable
- **WHEN** `relevo.yml` links `acme/design` and it cannot be read
- **THEN** `doctor` reports a failed check naming `acme/design`
- **AND** its fix names `RELEVO_LINKS_TOKEN` and copying the file as the two ways out

#### Scenario: Private linked repository with the secret present
- **WHEN** a linked repository is private and `RELEVO_LINKS_TOKEN` exists
- **THEN** `doctor` notes that the token's access to that repository was not verified

### Requirement: Doctor reports the effective runner
When a Relevo workflow takes `runs-on` from a repository variable, `doctor` SHALL read the variable (read-only) and compare the resulting runner with `runner.labels`. When they differ it SHALL print both and say that the variable wins. When the variable is unset the fallback written in the workflow SHALL be used. A value that cannot be parsed SHALL be reported as not judged.

#### Scenario: Variable overrides the file
- **WHEN** `runner.labels` is `[self-hosted, linux]` and the workflow's `runs-on` resolves through a variable set to `ubuntu-latest`
- **THEN** `doctor` warns, printing `[self-hosted, linux]` and `[ubuntu-latest]` and saying the variable wins

#### Scenario: Variable matches
- **WHEN** the effective runner equals `runner.labels`
- **THEN** `doctor` reports a passed check

#### Scenario: Variable cannot be read
- **WHEN** the repository variables cannot be read
- **THEN** `doctor` says the effective runner was not checked and does not report it as correct

### Requirement: Doctor warns about a stale pinned version
`doctor` SHALL compare each workflow's `RELEVO_VERSION` with the latest published version of the package and, when the pin is older, SHALL warn and name what the newer versions fix, taken from the changelog. When the published version cannot be determined (offline, private package, registry error) `doctor` SHALL skip the comparison and add a note saying so.

#### Scenario: Pin older than published
- **WHEN** the workflows pin 0.14.2 and 0.14.4 is published
- **THEN** `doctor` warns and lists the changelog entries of the versions after 0.14.2

#### Scenario: Pin is current
- **WHEN** the pin equals the published version
- **THEN** `doctor` reports a passed check

#### Scenario: Registry unreachable
- **WHEN** the published version cannot be read
- **THEN** `doctor` reports a note that the version comparison was skipped and why, and no warning

### Requirement: Doctor warns when the base branch requires no status checks
When branch protection can be read and the base branch does not require status checks, `doctor` SHALL warn, because `ship` relies on them. When branch protection cannot be read for lack of permission, `doctor` SHALL say it could not be checked and SHALL NOT report it as satisfied.

#### Scenario: No required checks
- **WHEN** the base branch has a ruleset with no required status checks
- **THEN** `doctor` warns that `ship` relies on required checks

#### Scenario: Checks required
- **WHEN** the base branch requires status checks
- **THEN** `doctor` reports a passed check

#### Scenario: No permission to read protection
- **WHEN** the branch rules cannot be read
- **THEN** `doctor` reports that they could not be checked, not that they are fine

### Requirement: Init proposes the fix for each environment finding
`init` SHALL include in its plan a step for each finding above: a manual step for the token, the runner variable and the branch protection, and the existing merge update for a workflow whose pin is stale. `init` SHALL NOT change branch protection or secrets for these findings, and `doctor` SHALL remain read-only.

#### Scenario: Stale pin
- **WHEN** `init` runs and a workflow pins an older version than the published one
- **THEN** the plan includes the workflow update, applied only after confirmation

#### Scenario: Missing required checks
- **WHEN** the base branch requires no status checks
- **THEN** the plan lists a manual step to require them and `init` changes nothing in the protection
