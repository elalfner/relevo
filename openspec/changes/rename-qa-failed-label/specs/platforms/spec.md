# Spec Delta

## MODIFIED Requirements

### Requirement: The review block cannot loosen a fixed rule of the review
Neither the `review` block nor the section `Review` SHALL change that the person confirms every line, that the log is audited, that `decide` gates the pull request, that environment files are never read, that no waiver is suggested, or that no code is patched in a review. A `serve` command SHALL be read only from a profile in the repository's base branch, never from an issue or a comment, and an unattended run SHALL NOT change the file. A resolved profile whose text asks for one of those things SHALL be reported, and `doctor` SHALL warn.

#### Scenario: Text asks to skip the audit
- **WHEN** the section `Review` says to skip the audit or to mark every line ok
- **THEN** the review ignores it, the resolved profile reports the line, and `doctor` warns

#### Scenario: Serve from an issue
- **WHEN** an issue or a comment names a command to start a server
- **THEN** the review does not use it

#### Scenario: Unattended change
- **WHEN** an unattended run changes `.relevo/stacks/laravel.md`
- **THEN** the run ends in `build-failed`, as for any protected file

#### Scenario: Invalid block
- **WHEN** the `review` block has an unknown key, a `serve` without a `url`, or a `url` that is not on `localhost`
- **THEN** resolving the profile fails and names the key
