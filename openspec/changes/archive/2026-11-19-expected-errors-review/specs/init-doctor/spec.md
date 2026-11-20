# Init and doctor

## ADDED Requirements

### Requirement: Doctor reports the expected errors a repository declares
For a declared adapter whose profile sets `review.expected_errors`, `doctor` SHALL note the number of patterns, saying that the audit lists the errors that contain them without flagging them and that a waiver stays the person's decision. It SHALL add nothing when the key is not set.

#### Scenario: Declared patterns
- **WHEN** the repository's `nhost` profile lists three patterns
- **THEN** `doctor` notes that three expected-error patterns are declared

#### Scenario: Not set
- **WHEN** no profile sets the key
- **THEN** `doctor` adds no check for it

### Requirement: Doctor warns when expected_errors is ignored or invalid
`doctor` SHALL warn, naming the key, when the repository's profile of a stack that is not declared sets `review.expected_errors`, and SHALL report an invalid entry as an invalid profile naming `review.expected_errors`.

#### Scenario: Ignored on a shipped stack
- **WHEN** the repository's `supabase` profile sets `review.expected_errors`
- **THEN** `doctor` warns that the key is ignored

#### Scenario: Invalid entry
- **WHEN** an entry is `FATAL`
- **THEN** `doctor` reports the profile as invalid and names `review.expected_errors`
