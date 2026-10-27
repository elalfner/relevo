# Spec Delta

## MODIFIED Requirements

### Requirement: A release is published before it is promoted
A tag `vX.Y.Z` SHALL publish the package with that version, using the identity of the workflow run and no stored token, and the release steps SHALL publish before the promotion to `main`, so that the templates on `main` never pin a package version that does not exist.

#### Scenario: Version and tag differ
- **WHEN** the tag does not match the version in the package
- **THEN** the release workflow stops without publishing

#### Scenario: Promoting before publishing
- **WHEN** `main` receives the release before the package is published
- **THEN** a project that copies a template from `main` pins a version that the registry does not have, and the release steps forbid that order

#### Scenario: A release with no stored token
- **WHEN** the repository has no `NPM_TOKEN` secret and npm trusts the workflow
- **THEN** the tag publishes the package, with provenance

#### Scenario: npm does not trust the workflow
- **WHEN** the trusted publisher on npm does not match the repository or the workflow file
- **THEN** the publish step fails with npm's message and nothing is published

#### Scenario: Reading the workflow
- **WHEN** a person reads the release workflow
- **THEN** it holds no reference to a publish token, and asks for the identity permission and for a Node version whose npm supports it
