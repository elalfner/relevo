# Spec Delta

## ADDED Requirements

### Requirement: Doctor checks what a Supabase review needs
For each platform whose stack is `supabase`, `doctor` SHALL check that the Supabase CLI can be found, that Docker is installed, that `supabase/config.toml` exists in the folder of the platform and, when Docker answers, whether the local stack is running. It SHALL warn, with the command to fix it, when one is missing, and SHALL note a stopped local stack, because the review needs it running (or the person's confirmation to start it). It SHALL NOT read `.env` files and SHALL NOT start anything.

#### Scenario: CLI missing
- **WHEN** a Supabase platform exists and `supabase` is not on the path
- **THEN** `doctor` warns and gives the install command

#### Scenario: Stack stopped
- **WHEN** Docker answers and the local stack is not running
- **THEN** `doctor` notes it and says the review asks before it runs `supabase start`

#### Scenario: No config
- **WHEN** `supabase/config.toml` does not exist in the folder of the platform
- **THEN** `doctor` warns and names the folder

#### Scenario: Not a Supabase platform
- **WHEN** no platform has the stack `supabase`
- **THEN** `doctor` adds none of these checks

## MODIFIED Requirements

### Requirement: Doctor checks the review block of a profile
`doctor` SHALL report, as the failure of an invalid profile, a `review` block that cannot be read or whose `test` targets a remote database (`--linked`, `--db-url`), and SHALL warn about a `serve` whose command is not on the base branch, a `log` that names files and matches none while its directory does not exist, a `log` that names a container (`docker:`) that does not exist while the local stack is running, or text in the section `Review` that asks for what the block cannot change. It SHALL list which `review` keys the repository replaced.

#### Scenario: Log path that matches nothing
- **WHEN** `review.log` is `var/log/app.log` and neither the file nor `var/log` exists
- **THEN** `doctor` warns and names the setting

#### Scenario: Container that does not exist
- **WHEN** `review.log` is `docker:supabase_db_other` and the local stack is running without such a container
- **THEN** `doctor` warns and names the setting

#### Scenario: Remote database in review.test
- **WHEN** `review.test` contains `--linked`
- **THEN** `doctor` reports the profile as invalid and names `review.test`

#### Scenario: Keys replaced
- **WHEN** the repository replaced `review.test`
- **THEN** `doctor` lists it as a note, not a failure

#### Scenario: Text that asks to skip the audit
- **WHEN** the section `Review` tells the agent to skip the audit
- **THEN** `doctor` warns that the review ignores it
