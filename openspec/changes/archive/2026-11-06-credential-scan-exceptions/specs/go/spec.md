## ADDED Requirements

### Requirement: A reviewed false positive of the credential scan can be listed with a reason
A person SHALL be able to list a credential finding as reviewed in `.relevo/scan-exceptions.json`, a list of entries each with a `path`, a `pattern` and a `reason`. The scan of a diff (the safe commit and the validation gate) SHALL NOT report a credential finding whose file matches the `path` and whose added line contains the `pattern`; the match SHALL NOT depend on the line number. Every other finding SHALL be reported and refused as before. Temporary markers SHALL NOT be excepted. The list SHALL be read from the committed file (HEAD for a commit, the base ref for the gate), never from the working tree, and `.relevo/` is a protected path, so an unattended run cannot change it.

#### Scenario: A listed line goes through
- **WHEN** the staged diff holds a credential finding on a line that an entry lists by path and pattern, with a reason
- **THEN** the commit is made and the report says one exception was applied, with its path and reason

#### Scenario: The line moved
- **WHEN** the listed line is at another line number of the same file
- **THEN** the exception still applies

#### Scenario: A finding that is not listed
- **WHEN** the scan flags a line no entry covers, or a listed path with another line
- **THEN** the commit is refused and nothing is pushed, as before

#### Scenario: Too broad an entry
- **WHEN** an entry names a folder, uses `**` or a bare `*` file name, has a pattern of fewer than 8 characters, or has no reason
- **THEN** it is never applied and the report names it as refused

#### Scenario: An edit that is not committed
- **WHEN** the working tree holds an exception that the committed file does not
- **THEN** it is not applied

#### Scenario: A marker
- **WHEN** a temporary marker is flagged on a listed line
- **THEN** it is still refused

#### Scenario: The gate
- **WHEN** the validation gate scans a diff with a listed finding
- **THEN** the scan passes and its detail says the exception was applied
