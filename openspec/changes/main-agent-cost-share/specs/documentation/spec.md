## ADDED Requirements

### Requirement: The documentation explains the share of the main agent
The execution page SHALL explain, in English and in Spanish, the line of the digest about the main agent: that its figures come from the agents listed in the usage comment of each run, which runs are counted, that a share above half is a prompt to decide and not a decision, and that the runner counts only the turns of the main agent against `limits.run_max_turns`.

#### Scenario: Both languages
- **WHEN** the English page describes the line
- **THEN** the Spanish page describes the same line with the same figures and the same setting names

#### Scenario: The decision is named
- **WHEN** a reader looks for what to do when the share is above half
- **THEN** the page names the three options (a cheaper model for the orchestrator, fewer turns, leaving it) and says that none is applied automatically
