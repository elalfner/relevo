## ADDED Requirements

### Requirement: The digest is posted as a comment on the issue named by digest.issue
The daily digest SHALL be posted as one comment on the issue whose number is `digest.issue` in `relevo.yml`. When there is a digest to post and `digest.issue` is not set, the run SHALL end with an error that names the key, and SHALL NOT post anywhere else. A dry run, and a run that reads its state from an input file, SHALL print the text and post nothing.

#### Scenario: The digest goes to the configured issue
- **WHEN** a digest is posted and `digest.issue` is `42`
- **THEN** it is one comment on issue 42 of the repository

#### Scenario: No issue is configured
- **WHEN** there is a digest to post and `digest.issue` is not set
- **THEN** the run ends with an error that names `digest.issue` and nothing is posted

#### Scenario: A dry run posts nothing
- **WHEN** the digest is run with `--dry-run` or from an input file
- **THEN** its text is printed and no comment is written

### Requirement: No digest is posted on a weekend
A digest SHALL NOT be posted on a Saturday or a Sunday, counted in UTC, whatever is waiting or alerted. Reading an input file SHALL happen on every day, so that its validity does not depend on the calendar.

#### Scenario: A Saturday
- **WHEN** the digest runs on a Saturday and issues are waiting
- **THEN** nothing is posted and nothing is printed

#### Scenario: A weekday
- **WHEN** the digest runs on a Monday to Friday and something is waiting
- **THEN** the digest is posted as usual
