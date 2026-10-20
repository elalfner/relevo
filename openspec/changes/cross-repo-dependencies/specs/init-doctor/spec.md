## ADDED Requirements

### Requirement: Doctor checks the linked repositories
When `links` is not empty, `doctor` SHALL check that each linked repository can be read, and that the secret `RELEVO_LINKS_TOKEN` exists (its name only, never its value); a missing secret is a warning when every linked repository is public and a failure when one is private. When `links` is empty, none of this is checked.

#### Scenario: Private linked repository without the secret
- **WHEN** `links` lists a private repository and the secret does not exist
- **THEN** `doctor` fails that check and says to create a read-only token and store it as `RELEVO_LINKS_TOKEN`

#### Scenario: Public linked repositories
- **WHEN** every linked repository is public and no secret exists
- **THEN** `doctor` warns, because the gate works without it but a private repository added later would not

#### Scenario: No links
- **WHEN** `links` is empty
- **THEN** `doctor` does not mention the secret

### Requirement: Init asks for the linked repositories
`init` SHALL ask which repositories this one depends on, write `links`, and remind the person to create the read-only secret, without reading or writing it.

#### Scenario: Front and back
- **WHEN** the person names `acme/api`
- **THEN** `relevo.yml` has `links: [acme/api]` and `init` shows what token to create
