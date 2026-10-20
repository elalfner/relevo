# Spec Delta

## ADDED Requirements

### Requirement: The issue that is built is the issue that was approved
When the planner claims an issue it SHALL record a hash of the issue title and body in its decision, and `go` SHALL verify it before writing the specification. If it differs, the run SHALL end in `qa-failed` with the reason "issue changed after ready" and push nothing. Line endings and trailing spaces SHALL NOT change the hash.

#### Scenario: Issue edited after ready
- **WHEN** the author edits the body of an issue after a maintainer applied `ready` and before `go` reads it
- **THEN** the hashes differ, nothing is built or pushed, and the issue is labelled `qa-failed` with the reason "issue changed after ready"

#### Scenario: Issue unchanged
- **WHEN** the title and body are the same as when the issue was claimed
- **THEN** `go` continues

#### Scenario: Only whitespace differs
- **WHEN** the body differs from the claimed one only in line endings or trailing spaces
- **THEN** the hashes are equal and `go` continues

#### Scenario: Run started by hand
- **WHEN** someone runs `go` for an issue without a decision from the workflow
- **THEN** the same hash is computed when the issue is claimed and verified before the specification is written

### Requirement: Protected paths
A diff produced by the unattended agent SHALL NOT touch workflows (`.github/`), `relevo.yml`, `.relevo/` or the folders of skills. It SHALL touch dependency manifests and lock files only when the issue lists them in an `Allow-paths:` line. A violation SHALL end the run in `qa-failed` with the reason "protected path in the diff", and nothing is pushed.

#### Scenario: Workflow edited
- **WHEN** the diff touches a file under `.github/`
- **THEN** the run ends in `qa-failed` with the reason "protected path in the diff", even if the issue lists that path

#### Scenario: Lock file without permission
- **WHEN** the diff touches a dependency lock file and the issue has no `Allow-paths:` line naming it
- **THEN** the run ends in `qa-failed` with the reason "protected path in the diff"

#### Scenario: Lock file with permission
- **WHEN** the issue says `Allow-paths: pubspec.yaml, pubspec.lock` and the diff touches only those protected files
- **THEN** the guard lets the diff pass

### Requirement: Dependencies are added only when authorized
The developer agent SHALL NOT add a dependency unless the issue allows its manifest through `Allow-paths:`. The workflow template SHALL install dependencies without running package scripts where the stack allows it.

#### Scenario: A dependency would solve it
- **WHEN** the developer finds that a new dependency would be needed and the issue does not allow its manifest
- **THEN** the developer does not add it and reports an open question, which sends the issue back to the spec writer

#### Scenario: Install in the workflow
- **WHEN** the workflow template installs the dependencies of a stack that supports it
- **THEN** it does so with the option that skips package scripts
