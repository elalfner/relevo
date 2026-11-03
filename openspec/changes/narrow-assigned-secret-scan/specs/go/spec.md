## ADDED Requirements

### Requirement: A literal assigned to a secret name is a possible credential
When the scan of a diff, an issue body or a configuration value finds a name such as `api_key`, `secret`, `token`, `password` or `passwd` assigned with `:` or `=`, it SHALL report a possible credential when the value is quoted and has 16 or more characters, or when the value is unquoted and looks like a literal secret: it mixes letters and digits, or contains `/`, `+` or `=`, and it is not followed by `(`, `.` or `[`.

### Requirement: Code that only names a secret is not a possible credential
The scan SHALL NOT report an unquoted value that is a plain identifier, a call or a member access. The provider patterns and the opaque-token check of configuration values SHALL NOT change, and a finding SHALL name the kind and the place, never the value.

#### Scenario: Reference to a variable
- **WHEN** an added line is `token: someLongVariableName`
- **THEN** the scan reports nothing

#### Scenario: Call
- **WHEN** an added line is `password = readPasswordFromVault(options)`
- **THEN** the scan reports nothing

#### Scenario: Member access
- **WHEN** an added line is `secret = config.clientSecretValue`
- **THEN** the scan reports nothing

#### Scenario: Quoted literal
- **WHEN** an added line is `api_key = "abcdefghijklmnopqrstuvwx"`
- **THEN** the scan reports a possible credential of the kind `assigned-secret`

#### Scenario: Unquoted literal with the look of a secret
- **WHEN** an added line is `password: hunter2hunter2hunter2`
- **THEN** the scan reports a possible credential of the kind `assigned-secret`

#### Scenario: Provider key
- **WHEN** an added line contains `ghp_` followed by 36 letters and digits, even assigned to a variable with another name
- **THEN** the scan reports the provider kind, as before
