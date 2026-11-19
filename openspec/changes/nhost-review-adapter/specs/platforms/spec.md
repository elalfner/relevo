# Spec Delta

## ADDED Requirements

### Requirement: The plugin ships a profile for Nhost
The plugin SHALL ship the profile `nhost` (no targets, `interface: none`) with `analyze` and `test` as npm scripts run from the platform's folder, `review.log` and `review.test` as the defaults of its adapter, the tools `docker` and `node`, and security sections with sources and dates. It SHALL carry no `review.adapter` or `review.needs`.

#### Scenario: Nhost profile resolution
- **WHEN** the profile of `nhost` is read with no repository file
- **THEN** its commands, tools and `review` block are those above and it defines no targets

#### Scenario: A full repository profile
- **WHEN** a repository has `.relevo/stacks/nhost.md` with a `test` command that differs from the plugin's
- **THEN** the resolved profile keeps the plugin's command, lists the other as ignored, and the repository's body follows the plugin's
