# Spec Delta

## ADDED Requirements

### Requirement: The go workflow template installs the Supabase CLI
The `go` workflow template SHALL include a build-job step, guarded by the stack `supabase`, that installs the Supabase CLI. The step SHALL be active, not a comment, and SHALL be skipped for any other stack. Docker is not installed by the template: the hosted runner already has it.

#### Scenario: Issue for a Supabase platform
- **WHEN** the decision is `start` for a platform with stack `supabase`
- **THEN** the build job installs the Supabase CLI before the toolchain check, and the check does not report `supabase` as missing

#### Scenario: Issue for another platform
- **WHEN** the decision is `start` for a platform with stack `flutter`
- **THEN** the Supabase step is skipped and costs nothing

#### Scenario: Repository with a Flutter and a Supabase platform
- **WHEN** one issue says `Platform: app` (Flutter) and another says `Platform: backend` (Supabase)
- **THEN** each build installs only the toolchain of the stack of its own platform
