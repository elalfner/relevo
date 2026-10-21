# Spec Delta: review

## ADDED Requirements

### Requirement: Review restores the base branch upon completion
When `review` opens the pull request and cleans up evidence, it SHALL switch the repository working tree back to the base branch, ensuring the root directory remains clean and available for the developer or subsequent reviews.

#### Scenario: Pull request opened successfully
- **WHEN** the pull request is created at the conclusion of a review
- **THEN** `review` switches the repository working tree back to the base branch
