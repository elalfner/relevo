## ADDED Requirements

### Requirement: An issue can declare a pattern to follow
`go` SHALL read a `Pattern: #N` line of an issue like `Depends-on:` and `Allow-paths:`: outside code blocks, with or without a list marker. The number SHALL be an issue of the same repository; anything else on the line (another repository, several numbers, no number, a second line) SHALL be reported as a problem and SHALL NOT be used, and `pattern-check.mjs` SHALL report a pattern that is the issue itself. The line SHALL NOT block the issue by itself: it only names where the template comes from.

#### Scenario: A valid pattern
- **WHEN** the body has `Pattern: #12`
- **THEN** the parsed issue has the pattern 12 and no problem

#### Scenario: A pattern that cannot be used
- **WHEN** the line is `Pattern: acme/api#12` or `Pattern: #12, #13`
- **THEN** the parsed issue has no pattern and names the problem

### Requirement: The pattern change is found before building
When the issue has a pattern, the build preflight SHALL look for the merged change of that issue and SHALL report, before any agent runs, a pattern that does not exist or whose change is not merged into the base branch, with the reason `inputs`. A lookup that cannot be made (no network, no access) SHALL NOT block the build; it SHALL be listed as unverified.

#### Scenario: The pattern is merged
- **WHEN** issue #12 was closed by a pull request merged into the base branch
- **THEN** the preflight passes and the files of that change are the template

#### Scenario: The pattern is not merged
- **WHEN** the pull request of #12 is open, or #12 has none
- **THEN** the issue goes to `needs-spec` with the reason `inputs` and the comment names #12 and says that its change is not merged

#### Scenario: The pattern does not exist
- **WHEN** #12 is not an issue of the repository
- **THEN** the same, saying that it does not exist

#### Scenario: The lookup fails
- **WHEN** GitHub cannot be read
- **THEN** the build goes on and the hand-off lists the pattern as not verified
