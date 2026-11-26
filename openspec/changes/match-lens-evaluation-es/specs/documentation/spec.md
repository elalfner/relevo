# Spec Delta

## MODIFIED Requirements

### Requirement: Every page exists in both languages with the same structure
Every page of the documentation SHALL exist in English and Spanish with the same sections in the same order, the same commands and the same links, and every page SHALL be in the list that the parity test checks.

#### Scenario: A page without its translation
- **WHEN** a page exists in one language only
- **THEN** the test fails and names it

#### Scenario: A page missing from the checked list
- **WHEN** a page exists in `docs/` and is neither in the list that the parity test checks nor in the short list of pages that are English only by decision
- **THEN** the test fails and names it

#### Scenario: A section translated in one language only
- **WHEN** a page has a section in one language that the other language does not have
- **THEN** the parity test fails and names the page
