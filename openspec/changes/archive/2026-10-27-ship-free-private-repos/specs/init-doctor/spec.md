## MODIFIED Requirements

### Requirement: Doctor checks the repository contents
`doctor` SHALL check that the OpenSpec root is tracked by git (an empty `openspec/` folder is not stored, so a clean checkout or the runner would have none), that `evidence/` is ignored by git, that the lifecycle labels and the base branch exist, and that the plugin repository can be cloned by the runner with the credential the workflow uses.

#### Scenario: OpenSpec root not tracked
- **WHEN** `openspec/config.yaml` is missing from git
- **THEN** `doctor` fails that check and says to run `init` and commit the OpenSpec files

#### Scenario: Private plugin repository
- **WHEN** the workflow clones a private plugin repository with a plain URL
- **THEN** `doctor` fails that check and says to store a read-only token and use the private-repository line of the workflow

#### Scenario: Branch protection unavailable
- **WHEN** the platform refuses to report branch protection because of the plan (for example a private repository on a free plan)
- **THEN** `doctor` reports a note, not a warning or a failure, that branch protection is not available on this plan and that approval and merge are then enforced only by the written confirmation in `ship`

#### Scenario: Branch rules unreadable for another reason
- **WHEN** the platform refuses to report branch protection for a reason other than the plan
- **THEN** `doctor` warns that the rules were not checked and says to run it again or to check the access to the repository
