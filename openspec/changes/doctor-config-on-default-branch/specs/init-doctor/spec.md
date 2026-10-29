# Spec Delta

## ADDED Requirements

### Requirement: Doctor compares the configuration the cloud reads with the base branch
When the default branch is not the base branch, `doctor` SHALL read `relevo.yml` from both branches on GitHub and warn when their settings differ or when the default branch has none while the base branch has one, saying that the cloud uses the copy on the default branch and giving the fix of promoting the base branch or making it the default branch. Differences in comments or layout alone SHALL NOT warn.

#### Scenario: A limit changed only on the base branch
- **WHEN** the default branch is `main`, the base branch is `dev`, and `limits.run_max_turns` differs between their `relevo.yml`
- **THEN** `doctor` warns that the cloud reads `relevo.yml` from `main`, which differs from `dev`, and the fix says to promote `dev` to `main` or to make `dev` the default branch

#### Scenario: Only a comment differs
- **WHEN** the two files differ only in comments or whitespace and give the same settings
- **THEN** `doctor` passes the check

#### Scenario: No configuration on the default branch
- **WHEN** the base branch has `relevo.yml` and the default branch does not
- **THEN** `doctor` warns that the cloud finds no `relevo.yml` on the default branch, with the same fix

#### Scenario: The base branch is the default branch
- **WHEN** the default branch is the base branch
- **THEN** `doctor` makes no comparison and reports nothing for it

#### Scenario: A branch cannot be read
- **WHEN** reading `relevo.yml` from either branch fails for a reason other than the file not existing, or the base branch has no `relevo.yml`
- **THEN** `doctor` reports nothing for the comparison and does not fail
