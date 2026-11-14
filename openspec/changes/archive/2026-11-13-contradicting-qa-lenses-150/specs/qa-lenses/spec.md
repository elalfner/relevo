## ADDED Requirements

### Requirement: Lenses that contradict each other stop the retries
When every blocking finding of an attempt reverses a finding that another lens asked for in the previous attempt and no longer asks for, a script SHALL mark the findings as contradictory, the developer agent SHALL NOT be relaunched, and the comment SHALL name both lenses and quote both findings. The script SHALL decide this from the reports alone, with no model.

#### Scenario: One lens rejects what another lens asked for
- **WHEN** on attempt 1 the `spec` lens asked to read the dialog question from a constant, and on attempt 2 the `spec` lens no longer asks for it and the `code` lens rejects the assertions on that constant
- **THEN** the aggregation reports a contradiction naming `spec`, `code` and both findings, the result stays `QA REJECTED`, and the developer agent is not relaunched

#### Scenario: The findings do not contradict each other
- **WHEN** the findings of the lenses share no quoted words with an earlier finding of another lens, or another blocking finding exists
- **THEN** the aggregation reports no contradiction and the retry runs as before

#### Scenario: The same lens repeats a finding
- **WHEN** a lens reports on the next attempt a finding that it had already reported, or the lens that asked first still asks for it
- **THEN** it is not a contradiction and the retry runs as before

### Requirement: A contradiction never lets a guard pass
A contradiction SHALL NOT make a rejection pass, and a blocking finding of the `security` lens or of a hard rule SHALL NOT be treated as one side of a contradiction. When the script cannot tell, the retry SHALL run as it does without the check.

#### Scenario: A security finding is among the blocking findings
- **WHEN** the `security` lens or a hard rule blocks on the attempt, even if another finding of it shares words with an earlier one
- **THEN** no contradiction is reported and the retry runs as before

#### Scenario: The previous reports are missing or unreadable
- **WHEN** the previous attempt's reports are not given, or one cannot be read or has no valid first line
- **THEN** no contradiction is reported and the result is the one of the attempt alone
