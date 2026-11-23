## ADDED Requirements

### Requirement: Doctor reports the expected fatals a repository declares
For a declared adapter whose profile sets `review.expected_fatals`, `doctor` SHALL note the number of messages, saying that the audit lists the fatal lines that equal them without flagging them and that a waiver stays the person's decision. It SHALL add nothing when the key is not set.

#### Scenario: Declared messages
- **WHEN** the repository's `nhost` profile lists one message
- **THEN** `doctor` notes that one expected-fatal message is declared

#### Scenario: Not set
- **WHEN** no profile sets the key
- **THEN** `doctor` adds no check for it

### Requirement: Doctor warns when expected_fatals is ignored or invalid
`doctor` SHALL warn, naming the key, when the repository's profile of a stack that is not declared sets `review.expected_fatals`, and SHALL report an invalid entry as an invalid profile naming `review.expected_fatals`.

#### Scenario: Ignored on a shipped stack
- **WHEN** the repository's `supabase` profile sets `review.expected_fatals`
- **THEN** `doctor` warns that the key is ignored

#### Scenario: Invalid entry
- **WHEN** an entry is `PANIC: could not write`
- **THEN** `doctor` reports the profile as invalid and names `review.expected_fatals`
